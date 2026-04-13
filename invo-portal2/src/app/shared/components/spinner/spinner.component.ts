import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
} from '@angular/core';
import { CommonModule } from '@angular/common';

export type SpinnerSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | number;

/**
 * SpinnerComponent
 * ────────────────
 * A tiny, dependency-free SVG spinner. Use it anywhere you need a "loading"
 * indicator that's smaller than a full overlay — inside buttons, table cells,
 * inline next to a label, etc.
 *
 * Color is inherited via `currentColor`, so it picks up the surrounding
 * `text-*` class. To force a specific color, set `color` to a Tailwind class
 * (e.g. `text-brand-600`) or pass through `class`.
 *
 * Sizes:
 *   • named: `xs` 12px, `sm` 16px, `md` 20px, `lg` 24px, `xl` 32px
 *   • numeric: any pixel value
 *
 * Examples:
 *   <app-spinner />                              <!-- 20px, currentColor -->
 *   <app-spinner size="xs" />                    <!-- 12px -->
 *   <app-spinner [size]="48" />                  <!-- 48px -->
 *   <app-spinner size="lg" class="text-brand-600" />
 *   <button>
 *     <app-spinner size="sm" />
 *     Saving…
 *   </button>
 */
@Component({
  selector: 'app-spinner',
  standalone: true,
  imports: [CommonModule],
  template: `
    <svg
      [attr.width]="px()"
      [attr.height]="px()"
      class="animate-spin"
      [attr.aria-hidden]="label() ? null : true"
      [attr.role]="label() ? 'status' : null"
      [attr.aria-label]="label()"
      fill="none"
      viewBox="0 0 24 24">
      <circle
        class="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        stroke-width="4"></circle>
      <path
        class="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 0 1 8-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 0 1 4 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
    </svg>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SpinnerComponent {
  /** Spinner size — named preset or pixel value. Default `md` (20px). */
  size = input<SpinnerSize>('md');

  /**
   * Optional accessible label. When set, the spinner becomes a live region
   * (`role="status" aria-label="…"`); otherwise it's `aria-hidden="true"`.
   */
  label = input<string | null>(null);

  /** Resolves the size input to a pixel number for the SVG attributes. */
  px = computed<number>(() => {
    const s = this.size();
    if (typeof s === 'number') return s;
    switch (s) {
      case 'xs': return 12;
      case 'sm': return 16;
      case 'md': return 20;
      case 'lg': return 24;
      case 'xl': return 32;
    }
  });
}
