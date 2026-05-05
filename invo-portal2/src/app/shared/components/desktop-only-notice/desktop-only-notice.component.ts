import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';

/**
 * DesktopOnlyNoticeComponent
 * ──────────────────────────
 * Drop-in full-screen overlay for builder pages that can't be used on a
 * phone (Table Management, Receipt Builder, etc.). The host's CSS-only
 * `@media` query reveals the overlay below `768 px` viewport width and
 * disables pointer events on the underlying page.
 *
 * Usage:
 *   <app-desktop-only-notice
 *     [titleKey]="'COMMON.DESKTOP_ONLY.TITLE'"
 *     [bodyKey]="'COMMON.DESKTOP_ONLY.BODY'"
 *   />
 *
 * Sits inside the page (not at app root) so each page can opt in
 * independently without bolting a global guard onto every route.
 * The default keys point at COMMON.DESKTOP_ONLY.* which lives in the
 * base i18n bundle, so no per-feature translations are required.
 */
@Component({
  selector: 'app-desktop-only-notice',
  standalone: true,
  imports: [CommonModule, TranslateModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <aside class="don" role="dialog" aria-modal="true">
      <div class="don__card">
        <svg class="don__icon" width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <rect x="2"  y="4" width="20" height="14" rx="2"/>
          <line x1="8"  y1="22" x2="16" y2="22"/>
          <line x1="12" y1="18" x2="12" y2="22"/>
        </svg>
        <h1 class="don__title">{{ titleKey() | translate }}</h1>
        <p class="don__body">{{ bodyKey() | translate }}</p>
      </div>
    </aside>
  `,
  styles: [`
    /* The notice is visually inert on desktop and only appears below
       the breakpoint. We use a fixed-position overlay rather than
       conditionally swapping the page content so the layout pipeline
       on the underlying builder isn't disturbed (no remeasurement on
       resize back across the breakpoint). */
    :host { display: none; }

    @media (max-width: 768px) {
      :host {
        display: block;
        position: fixed;
        inset: 0;
        z-index: 100;
      }
    }

    .don {
      position: fixed;
      inset: 0;
      background: rgba(15, 23, 42, 0.92);
      backdrop-filter: blur(4px);
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 24px;
      color: #fff;
      /* Block all clicks reaching the page underneath. Even though
         the host's z-index is high, on iOS Safari pointer-events
         occasionally bleed through; this kills it explicitly. */
      pointer-events: auto;
    }

    .don__card {
      max-width: 360px;
      text-align: center;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 12px;
    }

    .don__icon  { color: var(--color-brand-300, #7dd3fc); }
    .don__title { margin: 4px 0 0; font-size: 18px; font-weight: 700; line-height: 1.3; }
    .don__body  { margin: 0; font-size: 14px; line-height: 1.5; color: rgba(255, 255, 255, 0.85); }
  `],
})
export class DesktopOnlyNoticeComponent {
  /** i18n key for the heading. Defaults to a generic copy under
   *  `COMMON.DESKTOP_ONLY` so most callers just drop the component
   *  in without props. */
  titleKey = input<string>('COMMON.DESKTOP_ONLY.TITLE');
  bodyKey  = input<string>('COMMON.DESKTOP_ONLY.BODY');
}
