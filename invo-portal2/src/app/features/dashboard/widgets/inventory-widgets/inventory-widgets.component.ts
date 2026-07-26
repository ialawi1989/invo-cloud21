import {
  ChangeDetectionStrategy, Component, DestroyRef, computed, inject, input, signal,
} from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { catchError, of, switchMap, tap } from 'rxjs';
import { TranslateModule } from '@ngx-translate/core';

import { WidgetFrameComponent } from '../../components/widget-frame/widget-frame.component';
import { DashboardService } from '../../services/dashboard.service';
import { DashboardScope, ExpiringBatchRow, LowStockRow } from '../../services/dashboard.types';

/**
 * Low stock.
 *
 * Branch-scoped but date-independent — stock is a right-now fact, not a period
 * measure. The frame says so via the subtitle rather than leaving users to
 * wonder why the numbers don't move with the date filter (legacy didn't, and
 * this was a recurring support question).
 */
@Component({
  selector: 'app-low-stock-widget',
  standalone: true,
  imports: [CommonModule, TranslateModule, WidgetFrameComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-widget-frame
      skeleton="table"
      [title]="title()"
      subtitle="DASHBOARD.CURRENT_STOCK"
      [loading]="loading()"
      [error]="failed()"
      [empty]="isEmpty()"
      emptyText="DASHBOARD.NO_LOW_STOCK"
      skeletonHeight="200px"
      (retry)="retry()">

      <div class="iw__wrap">
        <table class="iw__table">
          <thead>
            <tr>
              <th>{{ 'DASHBOARD.PRODUCT' | translate }}</th>
              <th>{{ 'DASHBOARD.BRANCH' | translate }}</th>
              <th class="iw__num">{{ 'DASHBOARD.ON_HAND' | translate }}</th>
            </tr>
          </thead>
          <tbody>
            @for (row of rows(); track row.name + row.branchName) {
              <tr>
                <td class="iw__name">{{ row.name }}</td>
                <td class="iw__muted">{{ row.branchName }}</td>
                <td class="iw__num">
                  <span class="iw__pill" [class.is-out]="row.onHand <= 0" [class.is-low]="row.onHand > 0 && row.onHand <= 5">
                    {{ row.onHand }}
                  </span>
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    </app-widget-frame>
  `,
  styleUrl: './inventory-widgets.component.scss',
})
export class LowStockWidgetComponent {
  private service = inject(DashboardService);
  private destroyRef = inject(DestroyRef);

  readonly title = input.required<string>();
  readonly scope = input.required<DashboardScope>();

  readonly rows = signal<LowStockRow[]>([]);
  readonly loading = signal(true);
  readonly failed = signal(false);
  private readonly nonce = signal(0);
  readonly isEmpty = computed(() => this.rows().length === 0);

  constructor() {
    toObservable(computed(() => ({ branchId: this.scope().branchId, nonce: this.nonce() })))
      .pipe(
        tap(() => { this.loading.set(true); this.failed.set(false); }),
        switchMap(({ branchId }) =>
          this.service.lowStock(branchId).pipe(
            catchError(() => { this.failed.set(true); return of([] as LowStockRow[]); }),
          ),
        ),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((rows) => { this.rows.set(rows); this.loading.set(false); });
  }

  retry(): void { this.nonce.update((n) => n + 1); }
}

/** Rows per page, matching the legacy widget's page size. */
const PAGE_SIZE = 8;

/**
 * Expiring batches — same shape, plus a status tone per row (expired / within
 * 30 days), which the service already derives.
 */
@Component({
  selector: 'app-expiring-batches-widget',
  standalone: true,
  imports: [CommonModule, DatePipe, TranslateModule, WidgetFrameComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-widget-frame
      skeleton="table"
      [title]="title()"
      subtitle="DASHBOARD.CURRENT_STOCK"
      [loading]="loading()"
      [error]="failed()"
      [empty]="isEmpty()"
      emptyText="DASHBOARD.NO_EXPIRING"
      skeletonHeight="200px"
      (retry)="retry()">

      <!-- Pager mirrors the legacy widget: batches are unbounded, so the widget
           pages rather than growing without limit. -->
      @if (pageCount() > 1) {
        <span widgetActions class="iw__pager">
          <button type="button" (click)="prev()" [disabled]="page() === 1"
                  [attr.aria-label]="'COMMON.PREVIOUS' | translate">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
          </button>
          <span class="iw__pageNo">{{ page() }} / {{ pageCount() }}</span>
          <button type="button" (click)="next()" [disabled]="page() >= pageCount()"
                  [attr.aria-label]="'COMMON.NEXT' | translate">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
          </button>
        </span>
      }

      <div class="iw__wrap">
        <table class="iw__table">
          <thead>
            <tr>
              <th>{{ 'DASHBOARD.PRODUCT' | translate }}</th>
              <th>{{ 'DASHBOARD.BATCH' | translate }}</th>
              <th>{{ 'DASHBOARD.PRODUCTION_DATE' | translate }}</th>
              <th>{{ 'DASHBOARD.EXPIRES' | translate }}</th>
              <th class="iw__num">{{ 'DASHBOARD.ON_HAND' | translate }}</th>
            </tr>
          </thead>
          <tbody>
            @for (row of rows(); track row.productName + row.batch) {
              <tr>
                <td class="iw__name">{{ row.productName }}</td>
                <td class="iw__muted">{{ row.batch || '—' }}</td>
                <td class="iw__muted">{{ row.prodDate ? (row.prodDate | date: 'mediumDate') : '—' }}</td>
                <td>
                  <!-- Status is icon + text, never colour alone. -->
                  <span class="iw__status" [class.is-expired]="row.status === 'expired'" [class.is-soon]="row.status === 'soon'">
                    @if (row.status !== 'ok') {
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true">
                        <circle cx="12" cy="12" r="10"/><path d="M12 8v5"/><path d="M12 16h.01"/>
                      </svg>
                    }
                    {{ row.expireDate | date: 'mediumDate' }}
                  </span>
                </td>
                <td class="iw__num">{{ row.onHand }}</td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    </app-widget-frame>
  `,
  styleUrl: './inventory-widgets.component.scss',
})
export class ExpiringBatchesWidgetComponent {
  private service = inject(DashboardService);
  private destroyRef = inject(DestroyRef);

  readonly title = input.required<string>();
  readonly scope = input.required<DashboardScope>();

  readonly rows = signal<ExpiringBatchRow[]>([]);
  readonly loading = signal(true);
  readonly failed = signal(false);
  readonly page = signal(1);
  readonly pageCount = signal(1);
  private readonly nonce = signal(0);
  readonly isEmpty = computed(() => this.rows().length === 0);

  constructor() {
    toObservable(computed(() => ({
      branchId: this.scope().branchId, page: this.page(), nonce: this.nonce(),
    })))
      .pipe(
        tap(() => { this.loading.set(true); this.failed.set(false); }),
        switchMap(({ branchId, page }) =>
          this.service.expiringBatches(branchId, page, PAGE_SIZE).pipe(
            catchError(() => { this.failed.set(true); return of({ rows: [], pageCount: 1 }); }),
          ),
        ),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((res) => {
        this.rows.set(res.rows);
        this.pageCount.set(res.pageCount);
        this.loading.set(false);
      });
  }

  prev(): void { this.page.update((p) => Math.max(1, p - 1)); }
  next(): void { this.page.update((p) => Math.min(this.pageCount(), p + 1)); }

  retry(): void { this.nonce.update((n) => n + 1); }
}
