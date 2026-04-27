import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

/**
 * attribute-icon
 * ──────────────
 * Inline SVG icon for a dietary / lifestyle label tile. Each icon is hand
 * drawn at 24×24 with `currentColor` strokes — the host's `color` is set
 * per `iconKey` via a modifier class so the same SVG palette stays
 * consistent across the form.
 *
 * Falls back to a neutral tag glyph for unknown keys, so the tile always
 * renders something even if a backend extra label slips through.
 */
@Component({
  selector: 'app-pf-attribute-icon',
  standalone: true,
  template: `
    <span class="pf-attr-icon" [class]="'pf-attr-icon pf-attr-icon--' + iconKey()" aria-hidden="true">
      @switch (iconKey()) {
        @case ('organic') {
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M3 21c0-9 5-15 18-17-1 13-7 18-15 18-1 0-3-1-3-1Z"/>
            <path d="M3 21 13 11"/>
          </svg>
        }
        @case ('vegan') {
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 21V10"/>
            <path d="M12 14c-3 0-6-3-6-7 4 0 7 3 7 7"/>
            <path d="M12 18c2 0 5-3 5-6-3 0-5 2-5 6"/>
          </svg>
        }
        @case ('vegetarian') {
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M14 4l3 3-9 9-3 3-2-2 3-3 9-9z"/>
            <path d="M14 4l4-1-1 4"/>
            <path d="M11 7l1-3 3 1"/>
          </svg>
        }
        @case ('gluten-free') {
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 4v16"/>
            <path d="M12 8c-2-2-4-2-5 0 1 2 3 3 5 1"/>
            <path d="M12 8c2-2 4-2 5 0-1 2-3 3-5 1"/>
            <path d="M12 13c-2-2-4-2-5 0 1 2 3 3 5 1"/>
            <path d="M12 13c2-2 4-2 5 0-1 2-3 3-5 1"/>
            <line x1="4" y1="20" x2="20" y2="4" stroke-width="2.5"/>
          </svg>
        }
        @case ('dairy-free') {
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M8 3h8v3l2 4v10a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V10l2-4z"/>
            <path d="M6 10h12"/>
            <line x1="4" y1="20" x2="20" y2="4" stroke-width="2.5"/>
          </svg>
        }
        @case ('sugar-free') {
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="6" y="6" width="12" height="12" rx="2"/>
            <path d="M9 9l6 6M15 9l-6 6"/>
            <line x1="4" y1="20" x2="20" y2="4" stroke-width="2.5"/>
          </svg>
        }
        @case ('low-fat') {
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 3c-3 5-6 8-6 12a6 6 0 0 0 12 0c0-4-3-7-6-12z"/>
            <path d="M9 14l3 3 3-3"/>
          </svg>
        }
        @case ('low-sodium') {
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M8 3h8l1 5H7l1-5z"/>
            <path d="M7 8h10v12a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1V8z"/>
            <path d="M11 13l1 1 1-1M11 16l1 1 1-1"/>
          </svg>
        }
        @case ('high-protein') {
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M3 12h2"/>
            <path d="M19 12h2"/>
            <rect x="5"  y="9"  width="3" height="6" rx="1"/>
            <rect x="16" y="9"  width="3" height="6" rx="1"/>
            <rect x="8"  y="10" width="8" height="4" rx="1"/>
          </svg>
        }
        @case ('keto-friendly') {
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <ellipse cx="12" cy="13" rx="6" ry="8"/>
            <circle  cx="12" cy="14" r="2.5"/>
            <path d="M12 5v-2"/>
          </svg>
        }
        @case ('paleo') {
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M5 6a2.5 2.5 0 0 1 4-2 2.5 2.5 0 0 1 2 2l8 8a2.5 2.5 0 0 1 2 2 2.5 2.5 0 0 1-4 2 2.5 2.5 0 0 1-2-2l-8-8a2.5 2.5 0 0 1-2-2z"/>
          </svg>
        }
        @case ('raw') {
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M3 11h18"/>
            <path d="M5 11l2 8a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l2-8"/>
            <path d="M8 7c1-2 3-3 4-3M14 6c2-1 4 0 4 3"/>
            <path d="M9 11c0-2 2-4 3-4M13 9c2 0 3 1 3 2"/>
          </svg>
        }
        @case ('non-gmo') {
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M7 4c0 6 10 8 10 16"/>
            <path d="M17 4c0 6-10 8-10 16"/>
            <path d="M9 8h6M9 12h6M9 16h6"/>
            <line x1="4" y1="20" x2="20" y2="4" stroke-width="2.5"/>
          </svg>
        }
        @case ('kosher') {
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 3l3 5h6l-5 4 2 6-6-4-6 4 2-6-5-4h6z"/>
          </svg>
        }
        @case ('halal') {
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M19 16a8 8 0 1 1-7-13 6 6 0 0 0 7 13z"/>
          </svg>
        }
        @case ('spicy') {
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M5 19c4-1 8-5 12-12 1 1 2 3 2 5-3 6-9 9-14 9z"/>
            <path d="M16 4c1 1 2 1 3 0"/>
          </svg>
        }
        @case ('very-spicy') {
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 2c2 3 4 5 4 8a4 4 0 0 1-8 0c0-3 2-5 4-8z"/>
            <path d="M12 22a8 8 0 0 1-8-8c2 1 4 1 5 0 1 3 3 4 3 8z"/>
            <path d="M12 22a8 8 0 0 0 8-8c-2 1-4 1-5 0-1 3-3 4-3 8z"/>
          </svg>
        }
        @case ('fresh') {
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="4"/>
            <path d="M12 3v2M12 19v2M3 12h2M19 12h2M5 5l1 1M18 18l1 1M5 19l1-1M18 6l1-1"/>
          </svg>
        }
        @case ('angus-beaf') {
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M5 8c0-3 2-5 7-5s7 2 7 5v3c0 4-3 7-7 7s-7-3-7-7z"/>
            <path d="M3 6c1-1 3-2 5 0M21 6c-1-1-3-2-5 0"/>
            <circle cx="9.5"  cy="11" r="1"/>
            <circle cx="14.5" cy="11" r="1"/>
            <path d="M10 15c1 1 3 1 4 0"/>
          </svg>
        }
        @case ('no-sugar') {
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="6" y="6" width="12" height="12" rx="2"/>
            <line x1="4" y1="20" x2="20" y2="4" stroke-width="2.5"/>
          </svg>
        }
        @case ('lactose-free') {
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 3c-3 5-6 8-6 12a6 6 0 0 0 12 0c0-4-3-7-6-12z"/>
            <line x1="4" y1="20" x2="20" y2="4" stroke-width="2.5"/>
          </svg>
        }
        @case ('keto') {
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <ellipse cx="12" cy="13" rx="6" ry="8"/>
            <circle  cx="12" cy="14" r="2.5"/>
          </svg>
        }
        @case ('trans-fat-free') {
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 3c-3 5-6 8-6 12a6 6 0 0 0 12 0c0-4-3-7-6-12z"/>
            <line x1="4" y1="20" x2="20" y2="4" stroke-width="2.5"/>
            <path d="M9 14h6" stroke-width="2"/>
          </svg>
        }
        @case ('contain-alcohol') {
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M5 4h14L12 14 5 4z"/>
            <path d="M12 14v6"/>
            <path d="M8 20h8"/>
          </svg>
        }
        @case ('non-alcoholic') {
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M5 4h14L12 14 5 4z"/>
            <path d="M12 14v6"/>
            <path d="M8 20h8"/>
            <line x1="4" y1="20" x2="20" y2="4" stroke-width="2.5"/>
          </svg>
        }
        @default {
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/>
            <line x1="7" y1="7" x2="7.01" y2="7"/>
          </svg>
        }
      }
    </span>
  `,
  styleUrl: './attribute-icon.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AttributeIconComponent {
  iconKey = input.required<string>();
}
