import {
  ChangeDetectionStrategy, Component, DestroyRef, NgZone, inject, signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';

/**
 * A global "back to top" button, mounted once in the app shell so it appears on
 * every page.
 *
 * The app scrolls in two different places depending on the route: most pages
 * scroll the window, but full-height pages (`.no-padding`, e.g. the list pages)
 * scroll an inner element instead. A single capture-phase scroll listener on the
 * window sees both — scroll events don't bubble, but capturing listeners still
 * receive them from any descendant — so the button tracks whichever container is
 * actually scrolling and returns that one to the top.
 */
@Component({
  selector: 'app-scroll-top-button',
  standalone: true,
  imports: [CommonModule, TranslateModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (visible()) {
      <button type="button" class="stt" (click)="toTop()"
              [attr.aria-label]="'COMMON.BACK_TO_TOP' | translate"
              [title]="'COMMON.BACK_TO_TOP' | translate">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
             stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <polyline points="18 15 12 9 6 15"/>
        </svg>
      </button>
    }
  `,
  styles: [`
    .stt {
      position: fixed;
      inset-block-end: 24px;
      inset-inline-end: 24px;
      z-index: 900;
      width: 44px; height: 44px;
      display: inline-flex; align-items: center; justify-content: center;
      border: 0; border-radius: 50%;
      background: var(--color-brand-500, #32acc1); color: #fff;
      box-shadow: 0 6px 18px rgba(15, 23, 42, .22);
      cursor: pointer;
      animation: sttIn 160ms ease;
      transition: background 120ms ease, transform 120ms ease;
    }
    .stt:hover { background: var(--color-brand-600, #2691a4); transform: translateY(-1px); }
    .stt:active { transform: translateY(0); }
    .stt:focus-visible { outline: 2px solid var(--color-brand-700, #207484); outline-offset: 2px; }

    @keyframes sttIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }
    @media (prefers-reduced-motion: reduce) { .stt { animation: none; } }

    @media (max-width: 576px) {
      .stt { inset-block-end: 16px; inset-inline-end: 16px; width: 40px; height: 40px; }
    }
  `],
})
export class ScrollTopButtonComponent {
  private zone = inject(NgZone);
  private destroyRef = inject(DestroyRef);

  readonly visible = signal(false);
  /** The element currently doing the scrolling — where "to top" should apply. */
  private target: Element | Window = window;

  /** Show once scrolled this far down the active container. */
  private static readonly THRESHOLD = 300;

  constructor() {
    // Outside Angular: scroll fires constantly and must not trigger CD each time.
    this.zone.runOutsideAngular(() => {
      const onScroll = (e: Event) => this.onScroll(e);
      // capture:true so inner scroll containers are seen too (scroll doesn't bubble).
      window.addEventListener('scroll', onScroll, { capture: true, passive: true });
      this.destroyRef.onDestroy(() =>
        window.removeEventListener('scroll', onScroll, { capture: true }));
    });
  }

  private onScroll(e: Event): void {
    const node = e.target as Node | Document;
    const top = node === document || node === document.documentElement || node === document.body
      ? window.scrollY || document.documentElement.scrollTop
      : (node as Element).scrollTop ?? 0;

    this.target = node === document || node === document.documentElement || node === document.body
      ? window
      : (node as Element);

    const show = top > ScrollTopButtonComponent.THRESHOLD;
    if (show !== this.visible()) this.zone.run(() => this.visible.set(show));
  }

  toTop(): void {
    const behavior: ScrollBehavior =
      matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth';
    if (this.target === window) {
      window.scrollTo({ top: 0, behavior });
    } else {
      (this.target as Element).scrollTo({ top: 0, behavior });
    }
  }
}
