import {
  ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { MycurrencyPipe } from '@core/pipes/mycurrency.pipe';
import { DashboardService } from '../../services/dashboard.service';
import { SalesTargetSnapshot } from '../../services/dashboard.types';
import { WidgetFrameComponent } from '../../components/widget-frame/widget-frame.component';

/**
 * Sales target vs actual for the current month — target, actual, achievement
 * progress and forecast. Backed by the existing `salesTarget` dashboard
 * endpoint; shows an empty state when no target is set for the period.
 */
@Component({
  selector: 'app-sales-target-widget',
  standalone: true,
  imports: [CommonModule, TranslateModule, MycurrencyPipe, WidgetFrameComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-widget-frame
      skeleton="kpi"
      [title]="title()"
      subtitle="DASHBOARD.ST_SUB"
      [loading]="loading()"
      [error]="failed()"
      [empty]="isEmpty()"
      emptyText="DASHBOARD.ST_EMPTY"
      skeletonHeight="160px"
      (retry)="load()">

      @if (data(); as d) {
        <div class="st">
          <div class="st__row">
            <div class="st__col">
              <div class="st__label">{{ 'DASHBOARD.ST_ACTUAL' | translate }}</div>
              <div class="st__actual">{{ d.actual | mycurrency }}</div>
            </div>
            <div class="st__col st__col--end">
              <div class="st__label">{{ 'DASHBOARD.ST_TARGET' | translate }}</div>
              <div class="st__target">{{ d.target | mycurrency }}</div>
            </div>
          </div>

          <div class="st__bar">
            <span class="st__barFill" [class.st__barFill--over]="d.pct >= 100" [style.width.%]="clamp(d.pct)"></span>
          </div>
          <div class="st__pct">{{ d.pct | number:'1.0-0' }}% {{ 'DASHBOARD.ST_ACHIEVED' | translate }}</div>

          <div class="st__meta">
            <span>{{ 'DASHBOARD.ST_FORECAST' | translate }}: <b>{{ d.forecast | mycurrency }}</b></span>
            @if (d.daysRemaining) {
              <span>{{ 'DASHBOARD.ST_DAYS_LEFT' | translate:{ days: d.daysRemaining } }}</span>
            }
            @if (d.status) {
              <span class="st__status" [class]="'st__status--' + statusTone(d.status)">{{ d.status }}</span>
            }
          </div>
        </div>
      }
    </app-widget-frame>
  `,
  styleUrl: './sales-target.component.scss',
})
export class SalesTargetWidgetComponent {
  private service = inject(DashboardService);
  private destroyRef = inject(DestroyRef);

  readonly title = signal<string>('DASHBOARD.W.SALES_TARGET');
  setTitle(t: string) { this.title.set(t); }

  readonly data    = signal<SalesTargetSnapshot | null>(null);
  readonly loading = signal(true);
  readonly failed  = signal(false);
  readonly isEmpty = computed(() => !this.loading() && !this.failed() && this.data() === null);

  constructor() { this.load(); }

  clamp(pct: number): number { return Math.max(0, Math.min(100, pct)); }
  statusTone(s: string): 'ok' | 'warn' | 'bad' {
    const v = (s || '').toLowerCase();
    if (v.includes('ahead') || v.includes('on') || v.includes('achiev')) return 'ok';
    if (v.includes('behind') || v.includes('risk') || v.includes('miss')) return 'bad';
    return 'warn';
  }

  load(): void {
    this.loading.set(true);
    this.failed.set(false);
    // Current month, mirroring the sales-target dashboard's default period.
    const now = new Date();
    this.service.salesTargetSummary('monthly', now.getFullYear(), now.getMonth() + 1)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (d) => { this.data.set(d); this.loading.set(false); },
        error: () => { this.failed.set(true); this.loading.set(false); },
      });
  }
}
