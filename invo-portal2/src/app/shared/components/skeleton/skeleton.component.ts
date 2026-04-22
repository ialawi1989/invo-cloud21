import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { CommonModule } from '@angular/common';

/**
 * Reusable shimmer placeholder. Drop in anywhere a section is waiting on
 * async data. Three variants cover 90% of uses:
 *
 *   • `<app-skeleton variant="line" />`       — single 12-px bar (text)
 *   • `<app-skeleton variant="block" />`      — full-height block (cards)
 *   • `<app-skeleton variant="row" count="3" /> — stacked repeat (lists / tables)
 *
 * All sizing is CSS-driven via `width` / `height` inputs. Uses only a
 * `linear-gradient` + `animation`; no JS animation loop.
 */
@Component({
  selector: 'app-skeleton',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (variant() === 'row') {
      <div class="sk-rows">
        @for (_ of rangeArr(); track $index) {
          <div class="sk sk--block sk--row"></div>
        }
      </div>
    } @else {
      <div [class]="'sk sk--' + variant()"
           [style.width]="width()"
           [style.height]="height()"
           [style.border-radius]="rounded() ? '50%' : null"></div>
    }
  `,
  styles: [`
    :host { display: block; }

    .sk {
      display: block;
      background: linear-gradient(
        90deg,
        #f1f5f9 0%,
        #e2e8f0 40%,
        #f1f5f9 80%
      );
      background-size: 200% 100%;
      border-radius: 6px;
      animation: sk-shimmer 1.3s linear infinite;
    }

    .sk--line  { height: 12px; width: 100%; }
    .sk--block { height: 56px; width: 100%; border-radius: 10px; }
    .sk--row   { height: 44px; width: 100%; border-radius: 8px; }

    .sk-rows {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    @keyframes sk-shimmer {
      0%   { background-position: 200% 0; }
      100% { background-position: -200% 0; }
    }
  `],
})
export class SkeletonComponent {
  variant = input<'line' | 'block' | 'row'>('line');
  width   = input<string | null>(null);
  height  = input<string | null>(null);
  /** Number of stacked rows when `variant='row'`. */
  count   = input<number>(3);
  /** Render as a circular avatar/icon placeholder. */
  rounded = input<boolean>(false);

  rangeArr = computed(() => Array.from({ length: this.count() }));
}
