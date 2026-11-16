import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { SKELETON_STYLES } from './skeleton-styles';

/**
 * Placeholder for a form / settings page while its record loads.
 * Renders `cards` bordered cards, each with a heading bar and a grid of
 * label + input placeholders, so the real form replaces it without a
 * layout jump.
 *
 *   <app-form-skeleton />                         // 2 cards × 4 fields
 *   <app-form-skeleton [cards]="1" [fields]="6" />
 */
@Component({
  selector: 'app-form-skeleton',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { role: 'status', 'aria-busy': 'true', 'aria-label': 'Loading' },
  template: `
    @for (c of cardArr(); track $index) {
      <div class="fs-card">
        <div class="sk fs-title"></div>
        <div class="fs-grid" [style.grid-template-columns]="'repeat(' + columns() + ', minmax(0, 1fr))'">
          @for (f of fieldArr(); track $index) {
            <div class="fs-field">
              <div class="sk fs-label" [style.width.px]="60 + (($index * 23) % 50)"></div>
              <div class="sk fs-input"></div>
            </div>
          }
        </div>
      </div>
    }
  `,
  styles: [SKELETON_STYLES + `
    .fs-card {
      background: #fff;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      padding: 20px;
      margin-bottom: 16px;
    }
    .fs-title { width: 160px; height: 16px; margin-bottom: 18px; }
    .fs-grid { display: grid; gap: 16px 20px; }
    .fs-field { display: flex; flex-direction: column; gap: 8px; }
    .fs-label { height: 10px; }
    .fs-input { height: 38px; border-radius: 8px; }
    @media (max-width: 640px) {
      .fs-grid { grid-template-columns: minmax(0, 1fr) !important; }
    }
  `],
})
export class FormSkeletonComponent {
  cards   = input<number>(2);
  fields  = input<number>(4);
  columns = input<number>(2);

  cardArr  = computed(() => Array.from({ length: this.cards() }));
  fieldArr = computed(() => Array.from({ length: this.fields() }));
}
