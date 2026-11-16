import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { SKELETON_STYLES } from './skeleton-styles';

/**
 * Placeholder for a row of KPI / summary cards, optionally followed by a
 * chart-shaped block. Use while dashboard statistics or charts load so no
 * misleading zeros / empty axes are shown.
 *
 *   <app-stats-skeleton [cards]="4" />
 *   <app-stats-skeleton [cards]="0" [chart]="true" chartHeight="260px" />
 */
@Component({
  selector: 'app-stats-skeleton',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { role: 'status', 'aria-busy': 'true', 'aria-label': 'Loading' },
  template: `
    @if (cards() > 0) {
      <div class="ss-cards">
        @for (c of cardArr(); track $index) {
          <div class="ss-card">
            <div class="sk ss-label"></div>
            <div class="sk ss-value"></div>
            <div class="sk ss-sub"></div>
          </div>
        }
      </div>
    }
    @if (chart()) {
      <div class="sk ss-chart" [style.height]="chartHeight()"></div>
    }
  `,
  styles: [SKELETON_STYLES + `
    .ss-cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 16px; }
    .ss-card { background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px;
               display: flex; flex-direction: column; gap: 10px; }
    .ss-label { width: 45%; height: 10px; }
    .ss-value { width: 60%; height: 24px; }
    .ss-sub   { width: 35%; height: 10px; }
    .ss-chart { width: 100%; border-radius: 12px; margin-top: 16px; }
  `],
})
export class StatsSkeletonComponent {
  cards       = input<number>(4);
  chart       = input<boolean>(false);
  chartHeight = input<string>('240px');

  cardArr = computed(() => Array.from({ length: this.cards() }));
}
