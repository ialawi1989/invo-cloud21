import { Component, HostBinding, Input, OnInit, inject, signal } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { MycurrencyPipe, MynumberPipe } from '../../../../../core/pipes';
import { ProductsService, SalesByDayRow } from '../../../services/products.service';
import { VisibleDirective } from '../../../../../shared/directives/visible.directive';

/**
 * "Sales last 30 days" daily breakdown.
 * - Fully responsive table with horizontal scroll on narrow widths.
 * - Skeleton rows while loading.
 * - Empty state icon when the product has no sales.
 * - Uses global `mycurrency` / `mynumber` pipes → honours company locale.
 */
@Component({
  selector: 'app-sales-last-30-days',
  standalone: true,
  imports: [CommonModule, TranslateModule, DatePipe, MycurrencyPipe, MynumberPipe],
  hostDirectives: [VisibleDirective],
  template: `
    <div class="card">
      <div class="card-head">{{ 'PRODUCTS.SALES.LAST_30_DAYS' | translate }}</div>
      <div class="card-body">
        @if (loading() || !hasLoaded) {
          @for (i of [1,2,3,4,5]; track i) {
            <div class="row-skel">
              <div class="skeleton w-20"></div>
              <div class="skeleton w-15"></div>
              <div class="skeleton w-20"></div>
              <div class="skeleton w-15"></div>
              <div class="skeleton w-20"></div>
              <div class="skeleton w-15"></div>
              <div class="skeleton w-20"></div>
            </div>
          }
        } @else if (!rows().length) {
          <div class="empty">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="40" height="40">
              <path stroke-linecap="round" stroke-linejoin="round" d="M3 3v18h18M7 14l4-4 4 4 5-5"/>
            </svg>
            <p>{{ 'PRODUCTS.SALES.NO_LAST_30' | translate }}</p>
          </div>
        } @else {
          <div class="tbl-wrap">
            <table class="tbl">
              <thead>
                <tr>
                  <th class="start">{{ 'PRODUCTS.SALES.DAY'               | translate }}</th>
                  <th class="end">{{ 'PRODUCTS.SALES.SALES_QTY'          | translate }}</th>
                  <th class="end">{{ 'PRODUCTS.SALES.SALES_AMOUNT_TAX'   | translate }}</th>
                  <th class="end">{{ 'PRODUCTS.SALES.RETURN_QTY'         | translate }}</th>
                  <th class="end">{{ 'PRODUCTS.SALES.RETURN_AMOUNT_TAX'  | translate }}</th>
                  <th class="end">{{ 'PRODUCTS.SALES.NET_QTY'            | translate }}</th>
                  <th class="end">{{ 'PRODUCTS.SALES.NET_AMOUNT'         | translate }}</th>
                </tr>
              </thead>
              <tbody>
                @for (row of rows(); track row.day) {
                  <tr>
                    <td class="mono">{{ row.day | date:'dd/MM/yyyy HH:mm' }}</td>
                    <td class="end mono">{{ row.sales_qty               | mynumber }}</td>
                    <td class="end mono">{{ row.sales_amount_with_tax   | mycurrency }}</td>
                    <td class="end mono">{{ row.return_qty              | mynumber }}</td>
                    <td class="end mono">{{ row.return_amount_with_tax  | mycurrency }}</td>
                    <td class="end mono">{{ row.net_qty                 | mynumber }}</td>
                    <td class="end mono">{{ row.net_amount              | mycurrency }}</td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        }
      </div>
    </div>
  `,
  styles: [`
    :host { display: block; min-height: 280px; }
    :host(.loaded) { min-height: 0; }
    .card { background:#fff; border:1px solid #e2e8f0; border-radius:10px; overflow:hidden; }
    .card-head {
      padding:10px 14px; background:#f8fafc; border-bottom:1px solid #e2e8f0;
      font-size:13px; font-weight:600; color:#0f172a;
    }
    .card-body { padding:0; }
    .tbl-wrap { width:100%; overflow-x:auto; }
    .tbl { width:100%; border-collapse:separate; border-spacing:0; font-size:13px; }
    .tbl thead th {
      background:#f8fafc; color:#64748b;
      font-weight:600; font-size:11px; text-transform:uppercase; letter-spacing:.04em;
      padding:10px 14px; border-bottom:1px solid #e2e8f0;
      white-space:nowrap;
    }
    .tbl tbody td { padding:10px 14px; border-bottom:1px solid #f1f5f9; color:#0f172a; white-space:nowrap; }
    .tbl tbody tr:last-child td { border-bottom:none; }
    .tbl tbody tr:hover { background:#f8fafc; }
    .start { text-align:start; }
    .end   { text-align:end; }
    .mono  { font-variant-numeric:tabular-nums; }
    .empty {
      display:flex; flex-direction:column;
      align-items:center; justify-content:center;
      gap:8px;
      padding:48px 20px;
      color:#94a3b8;
    }
    .empty svg { opacity:.5; }
    .empty p { margin:0; font-size:13px; }

    /* Skeletons */
    .row-skel { display:grid; grid-template-columns: repeat(7, 1fr); gap:14px; padding:14px; border-bottom:1px solid #f1f5f9; }
    .row-skel:last-child { border-bottom:none; }
    @keyframes skel-shimmer { 0%{background-position:-200% 0;} 100%{background-position:200% 0;} }
    .skeleton {
      height:12px;
      background: linear-gradient(90deg,#e2e8f0 0%,#f1f5f9 50%,#e2e8f0 100%);
      background-size:200% 100%;
      animation: skel-shimmer 1.4s ease-in-out infinite;
      border-radius:6px;
    }
    .w-15 { width:50%; }
    .w-20 { width:75%; }
  `],
})
export class SalesLast30DaysComponent implements OnInit {
  @Input() productId: string | null = null;

  private svc = inject(ProductsService);
  private visibility = inject(VisibleDirective);

  hasLoaded = false;
  @HostBinding('class.loaded') get loadedClass() { return this.hasLoaded; }
  loading = signal(false);
  rows    = signal<SalesByDayRow[]>([]);

  ngOnInit(): void {
    this.visibility.visible.subscribe(() => {
      if (!this.hasLoaded) this.load();
    });
  }

  private async load(): Promise<void> {
    if (!this.productId) return;
    this.loading.set(true);
    try {
      const data = await this.svc.getProductSalesByDay(this.productId);
      this.rows.set(data);
    } catch (e) {
      console.error('[sales-last-30-days] load failed', e);
    } finally {
      this.loading.set(false);
      this.hasLoaded = true;
    }
  }
}
