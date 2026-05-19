import { Directive, Input, HostListener, OnDestroy, ElementRef } from '@angular/core';

@Directive({
  selector: '[appTooltip]',
  standalone: true,
})
export class TooltipDirective implements OnDestroy {
  @Input('appTooltip') text = '';

  private el: HTMLElement | null = null;
  private showTimer: any;

  constructor(private host: ElementRef<HTMLElement>) {}

  @HostListener('mouseenter')
  onEnter(): void {
    if (!this.text?.trim()) return;
    this.showTimer = setTimeout(() => this.show(), 120);
  }

  @HostListener('mouseleave')
  @HostListener('click')
  onLeave(): void {
    clearTimeout(this.showTimer);
    this.hide();
  }

  private show(): void {
    this.hide();

    const tip = document.createElement('div');
    tip.className = 'invo-tooltip';
    tip.textContent = this.text;
    tip.style.visibility = 'hidden';
    tip.style.top = '-9999px';
    tip.style.left = '-9999px';
    // Anchor the tooltip in the same stacking context as the host
    // so it can never be visually covered by an ancestor overlay.
    //
    // CDK drawers / modals open inside a top-level
    // `.cdk-overlay-container`. Each `.cdk-overlay-pane` inside that
    // container animates in with a `transform`, which establishes a
    // new stacking context — and crucially, the drawer-pane's
    // stacking context paints ABOVE any sibling overlay element
    // regardless of z-index (the pane visually layers on top of
    // tooltip siblings inside the container, even when the tooltip
    // is z-index 99999).
    //
    // To stay above the drawer's content, attach the tooltip INSIDE
    // the same pane as the host. The pane (or its descendants) carry
    // their own transform, which would normally re-anchor a
    // `position: fixed` tooltip to the transformed ancestor instead
    // of the viewport — so we switch the positioning math to be
    // relative to the pane's own client rect. Falls back to body for
    // hosts outside any overlay.
    const pane =
      this.host.nativeElement.closest<HTMLElement>('.cdk-overlay-pane') ??
      this.host.nativeElement.closest<HTMLElement>('.cdk-overlay-container') ??
      document.body;
    pane.appendChild(tip);
    this.el = tip;

    // When the tooltip lives inside a transformed overlay pane,
    // `position: fixed` resolves against that pane (not the
    // viewport) — so we anchor with `position: absolute` and offset
    // against the pane's own client rect. Plain body hosts keep the
    // original `position: fixed` so scrolling pages don't drag the
    // tooltip with them.
    const insidePane = pane !== document.body;
    if (insidePane) tip.style.position = 'absolute';

    const rect   = this.host.nativeElement.getBoundingClientRect();
    const origin = insidePane ? pane.getBoundingClientRect() : { left: 0, top: 0 };
    const tipW   = tip.offsetWidth;
    const tipH   = tip.offsetHeight;
    const margin = 8;
    const gap    = 10;
    const vw     = window.innerWidth;
    const vh     = window.innerHeight;

    // Host center X
    const hostCenterX = rect.left + rect.width / 2;

    // Preferred position: below
    let top    = rect.bottom + gap;
    let left   = hostCenterX - tipW / 2;
    let above  = false;

    // Flip above if not enough room below
    if (top + tipH > vh - margin) {
      top   = rect.top - tipH - gap;
      above = true;
    }

    // Clamp horizontally
    if (left < margin) left = margin;
    if (left + tipW > vw - margin) left = vw - tipW - margin;

    // Translate viewport coords into the pane's local space when the
    // tooltip lives inside a transformed overlay pane. Plain body
    // hosts use `origin = {0,0}`, so the math is a no-op for them.
    const localLeft = left - origin.left;
    const localTop  = top  - origin.top;

    tip.style.left = `${Math.round(localLeft)}px`;
    tip.style.top  = `${Math.round(localTop)}px`;
    tip.style.visibility = '';

    // Arrow points at the host center — expressed in the same local
    // coord space as `left` above so it stays aligned with the host.
    const arrowLeft = Math.round((hostCenterX - origin.left) - localLeft);
    tip.style.setProperty('--arrow-left', `${arrowLeft}px`);

    if (above) tip.classList.add('invo-tooltip--above');

    requestAnimationFrame(() => tip.classList.add('invo-tooltip--visible'));
  }

  private hide(): void {
    if (this.el) {
      this.el.remove();
      this.el = null;
    }
  }

  ngOnDestroy(): void {
    clearTimeout(this.showTimer);
    this.hide();
  }
}
