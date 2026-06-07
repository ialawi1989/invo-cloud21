import { Directive, ElementRef, HostListener, Input, OnDestroy } from '@angular/core';

/**
 * Ricos-style tooltip for the rich-editor toolbar.
 *
 * Renders a popover with the the rich editor data-hook contract:
 *   <div data-content-hook="popover-content--N" class="re__tooltip-root re__tooltip--dark re__tooltip--small">
 *     <div class="re__tooltip-element" data-hook="popover-element">
 *       <span>...label...</span>
 *     </div>
 *   </div>
 *
 * Behaviour:
 *  - 400 ms hover delay before showing (matches Ricos).
 *  - Positions above the host with a 4 px gap; clamps inside the
 *    viewport.
 *  - Dark chip styling lives in the component CSS so the directive
 *    stays markup-only.
 *  - Shows even for buttons styled as "disabled" (we don't bail on
 *    aria-disabled). Browsers only suppress mouseenter on the
 *    `disabled` HTML attribute combined with `pointer-events:none`,
 *    which the toolbar doesn't use.
 */
@Directive({
  selector: '[appReTooltip]',
  standalone: true,
})
export class RichTooltipDirective implements OnDestroy {
  @Input('appReTooltip') text = '';

  private el: HTMLElement | null = null;
  private showTimer: any;
  private static instanceCounter = 0;
  private readonly hookId = RichTooltipDirective.instanceCounter++;

  constructor(private host: ElementRef<HTMLElement>) {}

  @HostListener('mouseenter')
  onEnter(): void {
    if (!this.text?.trim()) return;
    this.showTimer = setTimeout(() => this.show(), 400);
  }

  @HostListener('mouseleave')
  @HostListener('mousedown')
  @HostListener('click')
  onLeave(): void {
    clearTimeout(this.showTimer);
    this.hide();
  }

  private show(): void {
    this.hide();

    const root = document.createElement('div');
    root.className = 're__tooltip-root re__tooltip--dark re__tooltip--small';
    root.setAttribute('data-content-hook', `popover-content--${this.hookId}`);
    // Inline styles — the directive appends to document.body which
    // sits outside the rich-editor's view-encapsulated CSS scope, so
    // a stylesheet rule wouldn't reach it. Inline declarations match
    // the Ricos spec: 4 px gap from host, 4 px radius, dark #162D3D
    // chip with white 12 px text, 4×6 padding for the small variant.
    Object.assign(root.style, {
      position: 'fixed',
      zIndex: '100000',
      pointerEvents: 'none',
      opacity: '0',
      transform: 'translateY(2px)',
      transition: 'opacity 120ms ease, transform 120ms ease',
      font: '500 12px/1.4 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      whiteSpace: 'normal',
      wordBreak: 'normal',
      overflowWrap: 'anywhere',
      borderRadius: '4px',
      background: '#162D3D',
      color: '#ffffff',
      boxShadow: '0 2px 6px rgba(15, 23, 42, 0.18)',
      maxWidth: '320px',
      visibility: 'hidden',
      top: '-9999px',
      left: '-9999px',
    } as Partial<CSSStyleDeclaration>);

    const element = document.createElement('div');
    element.className = 're__tooltip-element';
    element.setAttribute('data-hook', 'popover-element');
    element.textContent = this.text;
    Object.assign(element.style, {
      display: 'block',
      padding: '4px 6px',
    } as Partial<CSSStyleDeclaration>);
    root.appendChild(element);

    document.body.appendChild(root);
    this.el = root;

    const rect = this.host.nativeElement.getBoundingClientRect();
    const w    = root.offsetWidth;
    const h    = root.offsetHeight;
    const gap  = 4;
    const margin = 6;
    const vw   = window.innerWidth;
    const vh   = window.innerHeight;

    // Above the host with a 4 px gap (Ricos default). Flip below if
    // there isn't room overhead.
    let top  = rect.top - h - gap;
    let left = rect.left + rect.width / 2 - w / 2;
    if (top < margin) top = rect.bottom + gap;
    if (left < margin) left = margin;
    if (left + w > vw - margin) left = vw - w - margin;
    if (top + h > vh - margin)  top  = vh - h - margin;

    root.style.left = `${Math.round(left)}px`;
    root.style.top  = `${Math.round(top)}px`;
    root.style.visibility = '';
    requestAnimationFrame(() => {
      root.classList.add('is-visible');
      root.style.opacity = '1';
      root.style.transform = 'translateY(0)';
    });
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
