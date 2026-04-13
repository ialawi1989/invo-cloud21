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
    document.body.appendChild(tip);
    this.el = tip;

    const rect   = this.host.nativeElement.getBoundingClientRect();
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

    tip.style.left = `${Math.round(left)}px`;
    tip.style.top  = `${Math.round(top)}px`;
    tip.style.visibility = '';

    // Position arrow to point at host center, not bubble center
    const arrowLeft = Math.round(hostCenterX - left);
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
