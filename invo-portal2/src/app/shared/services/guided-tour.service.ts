import { Injectable, inject } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { driver, Driver, DriveStep, Side, Alignment } from 'driver.js';

import { EmployeeOptionsService } from '@core/layout/services/employee-options.service';

/**
 * Logical placement, resolved to a physical side at run time.
 *
 * A step that reads "to the right of this card" in English must read "to the
 * left of it" in Arabic, so the catalog never names a physical direction.
 * `block-*` is unaffected by direction and maps straight to top / bottom.
 */
export type TourSide = 'inline-start' | 'inline-end' | 'block-start' | 'block-end';

/** One step, described in terms the caller can write without touching the DOM. */
export interface GuidedTourStep {
  /**
   * Value of the `data-tour` attribute on the anchor element. Not a CSS
   * selector: callers shouldn't be encoding structure, and a step whose anchor
   * has been renamed should fail a test rather than silently point at nothing.
   * Omit for a step that floats in the middle of the screen (an intro).
   */
  anchor?: string;
  titleKey: string;
  bodyKey: string;
  side?: TourSide;
  align?: Alignment;
}

export interface GuidedTourOptions {
  /** Persisted per user (and per company — see {@link markSeen}). */
  tourKey: string;
  /** Show the "don't show this again" checkbox. Default true. */
  offerDontShowAgain?: boolean;
  onDone?: () => void;
}

/**
 * Logical side → the physical side driver.js positions against.
 *
 * Exported so the direction mapping can be asserted directly: RTL correctness
 * is the part most likely to regress unnoticed, since it looks fine to anyone
 * developing in English.
 */
export function toPhysicalSide(side: TourSide | undefined, rtl: boolean): Side | undefined {
  switch (side) {
    case 'inline-start': return rtl ? 'right' : 'left';
    case 'inline-end':   return rtl ? 'left' : 'right';
    case 'block-start':  return 'top';
    case 'block-end':    return 'bottom';
    default:             return undefined;
  }
}

/**
 * Alignment along a horizontal edge is physical too: `start` means "left" to
 * driver.js, which is the wrong end of a top/bottom popover under RTL.
 */
export function toPhysicalAlign(
  align: Alignment | undefined,
  side: TourSide | undefined,
  rtl: boolean,
): Alignment | undefined {
  if (!align || !rtl) return align;
  const horizontalEdge = side === 'block-start' || side === 'block-end' || !side;
  if (!horizontalEdge) return align;
  return align === 'start' ? 'end' : align === 'end' ? 'start' : align;
}

/**
 * GuidedTourService
 * ─────────────────
 * Shared wrapper around driver.js: step filtering, i18n, RTL and "seen"
 * bookkeeping in one place, so a feature only has to describe its steps.
 *
 * Two behaviours matter more than the rest:
 *
 *  • **Steps whose anchor isn't in the DOM are dropped.** Conditionally
 *    rendered UI — a feature-flagged card, a field that only exists for one
 *    role — is the normal case, not an edge case, and a tour must never
 *    spotlight nothing.
 *  • **"Seen" is stored per user**, via `EmployeeOptionsService` (server-side,
 *    so it follows the person across browsers), mirrored into localStorage so a
 *    failed options fetch doesn't replay a dismissed tour.
 *
 * The custom-report builder has its own older copy of this wrapper
 * (`features/reports/custom/services/report-tour.service.ts`). Folding it into
 * this service is a follow-up — it was left alone here so an employees change
 * doesn't alter a shipped reports feature.
 */
@Injectable({ providedIn: 'root' })
export class GuidedTourService {
  private translate = inject(TranslateService);
  private options = inject(EmployeeOptionsService);

  /** Marker class on <html> that scopes the tour's global styles. */
  private static readonly ACTIVE_CLASS = 'app-guided-tour-active';
  /** popoverClass, so our styling can't reach another consumer's popover. */
  private static readonly POPOVER_CLASS = 'app-guided-tour';

  private active: Driver | null = null;

  // ─── Seen bookkeeping ────────────────────────────────────────────────────

  /**
   * Has this user already been shown the tour?
   *
   * Server-side options are per person *per company* (both the read and the
   * write filter on companyId), so dismissing a tour at one company doesn't
   * dismiss it at another the same person works for.
   */
  async hasSeen(tourKey: string): Promise<boolean> {
    if (this.localSeen(tourKey)) return true;
    try {
      const opts = await this.options.get();
      return !!opts?.toursSeen?.[tourKey];
    } catch {
      return false;
    }
  }

  async markSeen(tourKey: string): Promise<void> {
    this.setLocalSeen(tourKey, true);
    try {
      const opts = await this.options.get();
      await this.options.patch({ toursSeen: { ...(opts?.toursSeen ?? {}), [tourKey]: true } });
    } catch {
      // Local mirror still holds it for this browser.
    }
  }

  async clearSeen(tourKey: string): Promise<void> {
    this.setLocalSeen(tourKey, false);
    try {
      const opts = await this.options.get();
      const next = { ...(opts?.toursSeen ?? {}) };
      delete next[tourKey];
      await this.options.patch({ toursSeen: next });
    } catch {
      /* no-op */
    }
  }

  private localKey(tourKey: string): string { return `tour.seen.${tourKey}`; }

  private localSeen(tourKey: string): boolean {
    try { return localStorage.getItem(this.localKey(tourKey)) === '1'; } catch { return false; }
  }

  private setLocalSeen(tourKey: string, seen: boolean): void {
    try {
      if (seen) localStorage.setItem(this.localKey(tourKey), '1');
      else localStorage.removeItem(this.localKey(tourKey));
    } catch { /* private mode */ }
  }

  // ─── Running ─────────────────────────────────────────────────────────────

  isRunning(): boolean { return this.active !== null; }

  /** True while the document is laid out right-to-left. */
  private isRtl(): boolean {
    return (document.documentElement.getAttribute('dir') ?? 'ltr').toLowerCase() === 'rtl';
  }

  /** Steps whose anchor is currently rendered, in catalog order. */
  private resolve(steps: GuidedTourStep[]): DriveStep[] {
    const rtl = this.isRtl();
    return steps
      .filter((s) => !s.anchor || !!document.querySelector(`[data-tour="${s.anchor}"]`))
      .map((s) => ({
        ...(s.anchor ? { element: `[data-tour="${s.anchor}"]` } : {}),
        popover: {
          title: this.translate.instant(s.titleKey),
          description: this.translate.instant(s.bodyKey),
          side: toPhysicalSide(s.side, rtl),
          align: toPhysicalAlign(s.align ?? 'start', s.side, rtl),
        },
      }));
  }

  /**
   * Drive a tour. Resolves to the number of steps actually shown — 0 when
   * nothing the tour describes is on screen, which the caller may want to
   * surface rather than flashing an empty tour.
   */
  async run(steps: GuidedTourStep[], opts: GuidedTourOptions): Promise<number> {
    const resolved = this.resolve(steps);
    if (resolved.length === 0) {
      opts.onDone?.();
      return 0;
    }

    this.stop();

    const offerDsa = opts.offerDontShowAgain !== false;
    const seenAtStart = offerDsa ? await this.hasSeen(opts.tourKey) : false;
    let dsaChecked = seenAtStart;

    document.documentElement.classList.add(GuidedTourService.ACTIVE_CLASS);

    this.active = driver({
      showProgress: true,
      animate: true,
      smoothScroll: true,
      allowClose: true,
      overlayColor: 'rgba(15, 23, 42, 0.65)',
      stagePadding: 6,
      stageRadius: 10,
      popoverClass: GuidedTourService.POPOVER_CLASS,
      nextBtnText: this.translate.instant('COMMON.TOUR.NEXT'),
      prevBtnText: this.translate.instant('COMMON.TOUR.BACK'),
      doneBtnText: this.translate.instant('COMMON.TOUR.DONE'),
      progressText: this.translate.instant('COMMON.TOUR.PROGRESS'),
      steps: resolved,
      onPopoverRender: (popover) => {
        // The popover lives in <body>; give it the document's direction so its
        // text and the checkbox row read correctly in Arabic.
        popover?.wrapper?.setAttribute('dir', this.isRtl() ? 'rtl' : 'ltr');
        if (!offerDsa || !popover?.wrapper) return;

        const row = document.createElement('div');
        row.className = 'app-guided-tour__dsa-row';

        const label = document.createElement('label');
        label.className = 'app-guided-tour__dsa';

        const cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.checked = dsaChecked;
        cb.addEventListener('change', () => {
          dsaChecked = cb.checked;
          void (cb.checked ? this.markSeen(opts.tourKey) : this.clearSeen(opts.tourKey));
        });

        label.appendChild(cb);
        label.appendChild(document.createTextNode(this.translate.instant('COMMON.TOUR.DONT_SHOW_AGAIN')));
        row.appendChild(label);

        if (popover.footer) popover.wrapper.insertBefore(row, popover.footer);
        else popover.wrapper.appendChild(row);
      },
      onDestroyed: () => {
        document.documentElement.classList.remove(GuidedTourService.ACTIVE_CLASS);
        this.active = null;
        opts.onDone?.();
      },
    });

    this.active.drive();
    return resolved.length;
  }

  stop(): void {
    if (this.active) {
      this.active.destroy();
      this.active = null;
    }
    document.documentElement.classList.remove(GuidedTourService.ACTIVE_CLASS);
  }
}
