import {
  AfterViewInit, ChangeDetectionStrategy, Component, DestroyRef, ElementRef, HostBinding, computed, contentChild, inject, input,
  signal, viewChild,
} from '@angular/core';
import { SettingsModeService } from '../../../core/layout/services/settings-mode.service';
import { BreadcrumbsComponent } from '../breadcrumbs/breadcrumbs.component';
import type { BreadcrumbItem } from '../breadcrumbs/breadcrumbs.types';
import { FormActionsComponent } from '../form-actions/form-actions.component';

/** Height of the fixed top bar the slim sticky bar sits under. */
const TOPBAR_PX = 56;

/**
 * The one page header of the app: breadcrumb, title, description, an optional count, and an actions slot.
 *
 * Fixed rhythm, the same on every page (no page overrides it):
 *   breadcrumb · 8px · title row (22px / 28px, weight 600) · 4px · description (14px / 20px, muted) · 20px · content
 *
 * - `trail` is the full trail a page already builds, ending with the page itself. The header shows only the PARENTS: the
 *   last crumb is dropped because the title is shown right below it. In settings mode `<app-breadcrumbs>` rewrites the
 *   trail to "Settings › Group".
 * - The one `<h1>` of the page lives here.
 * - Slots: `[pageLead]` (before the title — a logo), `[pageDescriptionExtra]` (inline after the description — a docs link),
 *   `[pageCount]` (inline after the title — a count pill, a status chip) and `[pageActions]` (end of the title row,
 *   top-aligned with it: primary actions, KPI cards, a Cards/Table toggle). Table toolbar controls stay in the table.
 * - A form page projects `<app-form-actions pageActions>` into the actions slot. When that header scrolls out of view the
 *   same actions turn into a slim bar directly under the top bar (title at the start, actions at the end), so Save never
 *   scrolls away. It is the same DOM, switched with CSS positioning: no layout shift, no duplicate buttons, same focus order.
 *
 * The header does not set any outer padding, margin or width: the shell's page frame owns those.
 */
@Component({
  selector: 'app-page-header',
  standalone: true,
  imports: [BreadcrumbsComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header class="ph" #root>
      @if (showCrumbs() && !bare()) {
        <app-breadcrumbs class="ph__crumbs" [items]="parents()" [trailIsParents]="true" separator="chevron"/>
      }
      <div class="ph__row">
        @if (!bare()) {
        <div class="ph__titles">
          <div class="ph__title-line">
            <ng-content select="[pageLead]"/>
            <h1 class="ph__title">{{ title() }}</h1>
            @if (count() !== null && count() !== undefined) { <span class="ph__count">{{ count() }}</span> }
            <ng-content select="[pageCount]"/>
          </div>
          @if (description()) { <p class="ph__desc">{{ description() }}<ng-content select="[pageDescriptionExtra]"/></p> }
        </div>
        }
        <div class="ph__actions"><ng-content select="[pageActions]"/></div>
      </div>
    </header>
    @if (stuck() && hasFormActions) {
      <div class="ph__bar" aria-hidden="true"><span class="ph__bar-title">{{ title() }}</span></div>
    }
  `,
  styles: [`
    :host { display: block; margin-bottom: 20px; }
    .ph { display: flex; flex-direction: column; }
    .ph__crumbs { display: block; margin-bottom: 8px; }
    .ph__row { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; }
    :host(.ph--has-form-actions) .ph__row { min-height: 36px; } /* the actions leave the flow when stuck: keep the height */
    .ph__titles { min-width: 0; flex: 1 1 auto; }
    .ph__title-line { display: flex; align-items: center; flex-wrap: wrap; gap: 10px; }
    .ph__title { margin: 0; font-size: 22px; line-height: 28px; font-weight: 600; color: var(--ui-text); letter-spacing: -0.01em; }
    .ph__count {
      display: inline-flex; align-items: center; padding: 0 10px; height: 22px; border-radius: 999px;
      background: var(--ui-surface-2); color: var(--ui-text-4); font-size: 12px; font-weight: 600;
    }
    .ph__desc { margin: 4px 0 0; font-size: 14px; line-height: 20px; color: var(--ui-muted); }
    .ph__actions { display: flex; align-items: flex-start; flex-wrap: wrap; justify-content: flex-end; gap: 8px; flex: 0 0 auto; }
    .ph__actions:empty { display: none; }
    :host(.ph--bare) { margin-bottom: 12px; }
    :host(.ph--bare) .ph__row { justify-content: flex-end; }

    /* ── Stuck: the header has scrolled under the top bar ─────────────────────────────────────────────────────────
       A slim bar (frame width, positioned from measured values) with the title; the actions element itself is lifted
       into it with fixed positioning. Below the top bar (60) and every dropdown / modal. */
    .ph__bar {
      position: fixed; z-index: 45; top: ${TOPBAR_PX}px; height: 48px; box-sizing: border-box;
      left: var(--ph-bar-left, 0); width: var(--ph-bar-width, 100%);
      padding-left: var(--ph-pad-left, 24px); padding-right: var(--ph-pad-right, 24px);
      display: flex; align-items: center;
      background: var(--ui-surface); border-bottom: 1px solid var(--ui-line); box-shadow: 0 2px 8px rgba(15, 23, 42, .06); /* theme-ok: shadow */
    }
    .ph__bar-title { font-size: 15px; font-weight: 600; color: var(--ui-text); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    @media (min-width: 640px) {
    :host(.ph--stuck) .ph__actions {
      position: fixed; z-index: 46; top: ${TOPBAR_PX + 6}px; height: 36px; align-items: center; flex-wrap: nowrap;
      left: var(--ph-act-left, auto); right: var(--ph-act-right, auto);
    }
    }

    @media (max-width: 767px) {
      .ph__row { flex-direction: column; align-items: stretch; gap: 12px; }
      .ph__actions { justify-content: flex-start; }
      .ph__bar { height: 44px; }
      :host(.ph--stuck) .ph__actions { top: ${TOPBAR_PX + 6}px; height: 32px; }
      :host(.ph--stuck) .ph__bar-title { max-width: 40%; }
    }
    /* Phones: the form actions live in a fixed bottom bar (see app-form-actions) — no actions in the header, no slim bar. */
    @media (max-width: 639px) {
      :host(.ph--has-form-actions) .ph__row { gap: 0; }
      :host(.ph--has-form-actions) .ph__actions { height: 0; overflow: visible; }
      :host(.ph--has-form-actions) .ph__bar { display: none; }
    }
    @media print { .ph__actions, .ph__bar { display: none !important; } }
  `]
})
export class PageHeaderComponent implements AfterViewInit {
  /** The page title (required). Rendered as the page's only <h1>. */
  readonly title = input.required<string>();
  readonly description = input<string | null>(null);
  /** A plain count shown as a badge after the title. For anything richer (a button, a skeleton) project `[pageCount]`. */
  readonly count = input<number | string | null>(null);
  /** The page's full trail, ending with the page itself; only the parents are shown. */
  readonly trail = input<BreadcrumbItem[]>([]);

  private readonly settings = inject(SettingsModeService);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly destroyRef = inject(DestroyRef);
  private readonly root = viewChild<ElementRef<HTMLElement>>('root');

  /** Present when this is a form page: only those headers turn their actions into the slim sticky bar. */
  private readonly formActions = contentChild(FormActionsComponent);
  /** Set when the form actions are projected through another component (a list page, a save bar), where they cannot be detected. */
  readonly stickyActions = input(false);
  /** Actions row only — for a page whose title and breadcrumb are already shown by a parent shell (the employee record). */
  readonly bare = input(false);
  @HostBinding('class.ph--bare') get isBare(): boolean { return this.bare(); }
  @HostBinding('class.ph--has-form-actions') get hasFormActions(): boolean { return !!this.formActions() || this.stickyActions(); }

  protected readonly stuck = signal(false);
  @HostBinding('class.ph--stuck') get isStuck(): boolean { return this.stuck() && this.hasFormActions; }

  protected readonly parents = computed<BreadcrumbItem[]>(() => {
    const t = this.trail();
    return t.length > 1 ? t.slice(0, -1) : [];
  });

  /** Parents to show, or — in the settings shell — the Settings › Group crumb even when a page has no parents of its own. */
  protected readonly showCrumbs = computed(() => this.parents().length > 0 || this.settings.crumbsInShell());

  ngAfterViewInit(): void {
    const el = this.root()?.nativeElement;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    // Stuck = the header's bottom edge has gone above the top bar. The margin makes "under the top bar" count as out of view.
    const io = new IntersectionObserver(([e]) => {
      const above = !e.isIntersecting && e.boundingClientRect.bottom < TOPBAR_PX + 1;
      if (above !== this.stuck()) { if (above) this.measure(); this.stuck.set(above); }
    }, { rootMargin: `-${TOPBAR_PX}px 0px 0px 0px`, threshold: [0, 1] });
    io.observe(el);
    // Keep the bar aligned with the content when the window or the frame resizes (sidebar collapse, rail toggle, rotation).
    const frame = this.host.nativeElement.closest('.page-frame');
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => { if (this.stuck()) this.measure(); }) : null;
    ro?.observe(this.host.nativeElement); if (frame) ro?.observe(frame);
    const onResize = () => { if (this.stuck()) this.measure(); };
    window.addEventListener('resize', onResize);
    this.destroyRef.onDestroy(() => { io.disconnect(); ro?.disconnect(); window.removeEventListener('resize', onResize); });
  }

  /** Physical positions for the fixed bar and actions, from where the content really is (rail, sidebar, RTL all included). */
  private measure(): void {
    const host = this.host.nativeElement;
    const frame = host.closest('.page-frame') as HTMLElement | null;
    if (!frame) return;
    const h = host.getBoundingClientRect(), f = frame.getBoundingClientRect();
    const vw = document.documentElement.clientWidth;
    const rtl = getComputedStyle(document.documentElement).direction === 'rtl';
    const s = host.style;
    s.setProperty('--ph-bar-left', f.left + 'px');
    s.setProperty('--ph-bar-width', f.width + 'px');
    s.setProperty('--ph-pad-left', Math.max(0, h.left - f.left) + 'px');
    s.setProperty('--ph-pad-right', Math.max(0, f.right - h.right) + 'px');
    s.setProperty('--ph-act-left', rtl ? h.left + 'px' : 'auto');
    s.setProperty('--ph-act-right', rtl ? 'auto' : Math.max(0, vw - h.right) + 'px');
  }
}
