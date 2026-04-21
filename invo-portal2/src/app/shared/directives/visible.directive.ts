import { Directive, ElementRef, EventEmitter, Input, OnDestroy, OnInit, Output } from '@angular/core';

/**
 * Emits once when the host element scrolls into view within its nearest
 * scrollable ancestor (not the document viewport).
 *
 * The directive walks up the DOM to find the first ancestor with
 * `overflow: auto | scroll` and uses it as the IntersectionObserver root.
 * This is critical for elements inside drawers, modals, or panels that
 * scroll independently of the page.
 *
 * Usage:
 *   <div (appVisible)="onVisible()">...</div>
 */
@Directive({
  selector: '[appVisible]',
  standalone: true,
})
export class VisibleDirective implements OnInit, OnDestroy {
  @Output('appVisible') visible = new EventEmitter<void>();

  private observer?: IntersectionObserver;

  constructor(private el: ElementRef<HTMLElement>) {}

  ngOnInit(): void {
    const root = this.findScrollParent(this.el.nativeElement);

    this.observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          this.visible.emit();
          this.observer?.disconnect();
        }
      },
      {
        root,           // observe relative to the scroll container, not the page
        threshold: 0.1,
      },
    );
    this.observer.observe(this.el.nativeElement);
  }

  ngOnDestroy(): void {
    this.observer?.disconnect();
  }

  /**
   * Walk up the DOM tree to find the nearest ancestor with scrollable overflow.
   * Returns `null` if none found (falls back to document viewport).
   */
  private findScrollParent(el: HTMLElement): HTMLElement | null {
    let node = el.parentElement;
    while (node) {
      const style = getComputedStyle(node);
      const overflow = style.overflowY || style.overflow;
      if (overflow === 'auto' || overflow === 'scroll') {
        return node;
      }
      node = node.parentElement;
    }
    return null;
  }
}
