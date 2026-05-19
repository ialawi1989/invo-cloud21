import {
  DestroyRef,
  Directive,
  ElementRef,
  EventEmitter,
  inject,
  Input,
  OnInit,
  Output,
} from '@angular/core';

/**
 * Fires `appInView` once when the host element first scrolls into
 * view (within `rootMargin`). Used by the label-builder list to
 * lazy-fetch full template payloads only for rows the user can
 * actually see — a full page of templates wouldn't be cheap to
 * eagerly hydrate.
 *
 * Single-shot by design: we tear down the observer after the first
 * intersection so subsequent re-scrolls don't spam events. If a
 * directive instance ever needs to re-arm, just remount it.
 *
 * Falls back to firing immediately when `IntersectionObserver` is
 * unavailable (legacy browsers, SSR) so behavior degrades to "fetch
 * everything" instead of "fetch nothing".
 */
@Directive({
  selector: '[appInView]',
  standalone: true,
})
export class InViewDirective implements OnInit {
  private host       = inject(ElementRef<HTMLElement>);
  private destroyRef = inject(DestroyRef);

  /** Pixel buffer around the viewport — the directive fires while
   *  the element is still this many pixels off-screen, so by the
   *  time it scrolls into actual view the data is ready. */
  @Input() rootMargin = '120px';

  @Output('appInView') readonly seen = new EventEmitter<void>();

  ngOnInit(): void {
    if (typeof IntersectionObserver === 'undefined') {
      // Legacy / SSR — just fire so callers still get their event.
      queueMicrotask(() => this.seen.emit());
      return;
    }

    const obs = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          this.seen.emit();
          obs.disconnect(); // single-shot
          return;
        }
      }
    }, { rootMargin: this.rootMargin });

    obs.observe(this.host.nativeElement);
    this.destroyRef.onDestroy(() => obs.disconnect());
  }
}
