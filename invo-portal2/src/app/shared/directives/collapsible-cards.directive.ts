import {
  Directive,
  ElementRef,
  NgZone,
  OnDestroy,
  afterNextRender,
  inject,
  input,
} from '@angular/core';

/**
 * Makes every `.pf-card` inside the host collapsible.
 *
 * Applied once on a container (the product form), it walks the subtree,
 * appends a chevron button to each `.pf-card__header` and toggles
 * `is-collapsed` on the card. A MutationObserver picks up cards that mount
 * later — sections behind `@if` / `@switch`, or re-ordered from the
 * Advanced Options modal.
 *
 * Why a directive and not 27 template edits: every section component ships
 * its own `.pf-card` markup, so wiring this by hand would mean the same
 * button, the same state signal and the same styles duplicated in each one
 * — and a 28th section would silently miss out.
 *
 * Collapsing only hides the card body; the controls stay in the form, so
 * validation and the save payload are unaffected (same contract as the
 * Advanced Options "hidden section" behaviour).
 *
 * Cards that already own a collapse control (the branches section has one
 * wired to its own state) are skipped — detected via `.pf-bp-chev`.
 */
@Directive({
  selector: '[appCollapsibleCards]',
  standalone: true,
})
export class CollapsibleCardsDirective implements OnDestroy {
  private host = inject<ElementRef<HTMLElement>>(ElementRef);
  private zone = inject(NgZone);

  // Both selectors are plain inputs, NOT aliased to `appCollapsibleCards`:
  // a value-less attribute binds '' rather than falling back to the default,
  // which would leave us calling querySelectorAll('').
  /** Card root selector — override if a consumer uses different chrome. */
  cardSelector = input<string>('.pf-card');
  /** Header selector, looked up inside each card. */
  headerSelector = input<string>('.pf-card__header');

  private get cardSel(): string { return this.cardSelector()?.trim() || '.pf-card'; }
  private get headerSel(): string { return this.headerSelector()?.trim() || '.pf-card__header'; }

  private observer?: MutationObserver;
  /** Cards already wired — a WeakSet so removed nodes don't leak. */
  private wired = new WeakSet<Element>();
  private frame = 0;

  constructor() {
    afterNextRender(() => {
      // Pure DOM work: no bindings change, so keep it out of the zone and
      // off the change-detection path entirely.
      this.zone.runOutsideAngular(() => {
        this.scan();
        this.observer = new MutationObserver(() => this.scheduleScan());
        this.observer.observe(this.host.nativeElement, { childList: true, subtree: true });
      });
    });
  }

  ngOnDestroy(): void {
    this.observer?.disconnect();
    if (this.frame) cancelAnimationFrame(this.frame);
  }

  /** Coalesce bursts of mutations into one scan per frame. */
  private scheduleScan(): void {
    if (this.frame) return;
    this.frame = requestAnimationFrame(() => {
      this.frame = 0;
      this.scan();
    });
  }

  private scan(): void {
    const cards = this.host.nativeElement.querySelectorAll<HTMLElement>(this.cardSel);
    cards.forEach((card) => {
      if (this.wired.has(card)) return;
      // `.pf-card__header` normally, falling back to a direct <header> child
      // for cards whose chrome is a tab bar (product media) instead.
      const header = card.querySelector<HTMLElement>(this.headerSel)
        ?? card.querySelector<HTMLElement>(':scope > header');
      // Only the card's own header — not one belonging to a nested card.
      if (!header || header.closest(this.cardSel) !== card) return;
      // Someone else already owns this card's collapse state.
      if (header.querySelector('.pf-bp-chev, .pf-card__chev')) {
        this.wired.add(card);
        return;
      }
      this.wire(card, header);
      this.wired.add(card);
    });
  }

  private wire(card: HTMLElement, header: HTMLElement): void {
    // Tags the row that must survive collapsing — the CSS keys off this
    // rather than `.pf-card__header`, so cards with custom header chrome
    // (the media tab bar) don't hide their own toggle.
    header.setAttribute('data-pf-card-header', '');

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'pf-card__chev';
    btn.innerHTML = CHEVRON_SVG;
    btn.setAttribute('aria-expanded', 'true');

    const title = header.querySelector('.pf-card__title')?.textContent?.trim();
    if (title) btn.setAttribute('aria-label', title);

    btn.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      const collapsed = card.classList.toggle('is-collapsed');
      btn.classList.toggle('pf-card__chev--up', collapsed);
      btn.setAttribute('aria-expanded', String(!collapsed));
    });

    header.appendChild(btn);
  }
}

const CHEVRON_SVG = `
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
       stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <polyline points="6 9 12 15 18 9"/>
  </svg>`;
