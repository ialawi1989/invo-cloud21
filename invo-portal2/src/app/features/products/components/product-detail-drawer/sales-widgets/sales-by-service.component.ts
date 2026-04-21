import { Component, HostBinding, Input, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { MynumberPipe } from '../../../../../core/pipes';
import { ProductsService, SalesByServiceRow } from '../../../services/products.service';
import { VisibleDirective } from '../../../../../shared/directives/visible.directive';

/**
 * "Sales By Service" widget — lives inside the product details drawer's
 * Sales tab. Loads its own data whenever the parent updates the product id
 * via `[productId]` input.
 */
@Component({
  selector: 'app-sales-by-service',
  standalone: true,
  imports: [CommonModule, TranslateModule, MynumberPipe],
  hostDirectives: [VisibleDirective],
  template: `
    @if (loading() || !hasLoaded) {
      <div class="card">
        <div class="card-head">{{ 'PRODUCTS.SALES.BY_SERVICE' | translate }}</div>
        <div class="card-body">
          @for (i of [1,2,3,4]; track i) {
            <div class="row-skel">
              <div class="skeleton skeleton--line w-40"></div>
              <div class="skeleton skeleton--line w-15"></div>
              <div class="skeleton skeleton--line w-15"></div>
              <div class="skeleton skeleton--line w-15"></div>
              <div class="skeleton skeleton--line w-15"></div>
            </div>
          }
        </div>
      </div>
    } @else if (rows().length) {
      <div class="card">
        <div class="card-head">{{ 'PRODUCTS.SALES.BY_SERVICE' | translate }}</div>
        <div class="card-body">
          <div class="tbl-wrap">
            <table class="tbl">
              <thead>
                <tr>
                  <th class="start">{{ 'PRODUCTS.SALES.SERVICE_NAME' | translate }}</th>
                  <th class="end">{{ 'PRODUCTS.SALES.NET_UNITS' | translate }}</th>
                  <th class="end">{{ 'PRODUCTS.SALES.NET_UNITS_PCT' | translate }}</th>
                  <th class="end">{{ 'PRODUCTS.SALES.NET_REVENUE' | translate }}</th>
                  <th class="end">{{ 'PRODUCTS.SALES.NET_REVENUE_PCT' | translate }}</th>
                </tr>
              </thead>
              <tbody>
                @for (row of rows(); track row.serviceName) {
                  <tr>
                    <td>{{ row.serviceName }}</td>
                    <td class="end mono">{{ row.net_units | mynumber }}</td>
                    <td class="end mono">{{ row.net_units_pct }} %</td>
                    <td class="end mono">{{ row.net_revenue | mynumber }}</td>
                    <td class="end mono">{{ row.net_revenue_pct }} %</td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        </div>
      </div>
    } @else {
      <div class="card">
        <div class="card-head">{{ 'PRODUCTS.SALES.BY_SERVICE' | translate }}</div>
        <div class="card-body">
          <div class="empty">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="40" height="40">
              <path stroke-linecap="round" stroke-linejoin="round" d="M3 3v18h18M7 14l4-4 4 4 5-5"/>
            </svg>
            <p>{{ 'PRODUCTS.SALES.NO_BY_SERVICE' | translate }}</p>
          </div>
        </div>
      </div>
    }
  `,
  styles: [`
    :host { display: block; min-height: 200px; }
    :host(.loaded) { min-height: 0; }
    .card {
      background: #fff;
      border: 1px solid #e2e8f0;
      border-radius: 10px;
      overflow: hidden;
    }
    .card-head {
      padding: 10px 14px;
      background: #f8fafc;
      border-bottom: 1px solid #e2e8f0;
      font-size: 13px; font-weight: 600; color: #0f172a;
    }
    .card-body { padding: 0; }

    .tbl-wrap { width: 100%; overflow-x: auto; }
    .tbl { width: 100%; border-collapse: separate; border-spacing: 0; font-size: 13px; }
    .tbl thead th {
      background: #f8fafc; color: #64748b;
      font-weight: 600; font-size: 11px;
      text-transform: uppercase; letter-spacing: .04em;
      padding: 10px 14px;
      border-bottom: 1px solid #e2e8f0;
    }
    .tbl tbody td {
      padding: 10px 14px;
      border-bottom: 1px solid #f1f5f9;
      color: #0f172a;
    }
    .tbl tbody tr:last-child td { border-bottom: none; }
    .tbl tbody tr:hover { background: #f8fafc; }
    .start { text-align: start; }
    .end   { text-align: end; }
    .mono  { font-variant-numeric: tabular-nums; }

    .empty {
      display: flex; flex-direction: column;
      align-items: center; justify-content: center;
      gap: 8px;
      padding: 48px 20px;
      color: #94a3b8;
    }
    .empty svg { opacity: .5; }
    .empty p { margin: 0; font-size: 13px; }

    /* Skeleton row mimics the table's column rhythm */
    .row-skel {
      display: grid;
      grid-template-columns: 2fr 1fr 1fr 1fr 1fr;
      gap: 14px;
      padding: 14px;
      border-bottom: 1px solid #f1f5f9;
    }
    .row-skel:last-child { border-bottom: none; }
    @keyframes skel-shimmer {
      0%   { background-position: -200% 0; }
      100% { background-position:  200% 0; }
    }
    .skeleton {
      height: 12px;
      background: linear-gradient(90deg, #e2e8f0 0%, #f1f5f9 50%, #e2e8f0 100%);
      background-size: 200% 100%;
      animation: skel-shimmer 1.4s ease-in-out infinite;
      border-radius: 6px;
    }
    .w-15 { width: 60%; }
    .w-40 { width: 90%; }

    /* RTL: table alignment flips via start / end tokens above. */
  `],
})
export class SalesByServiceComponent implements OnInit {
  @Input() productId: string | null = null;

  private svc = inject(ProductsService);
  private visibility = inject(VisibleDirective);

  hasLoaded = false;
  @HostBinding('class.loaded') get loadedClass() { return this.hasLoaded; }
  loading = signal(false);
  rows    = signal<SalesByServiceRow[]>([]);

  ngOnInit(): void {
    this.visibility.visible.subscribe(() => {
      if (!this.hasLoaded) this.load();
    });
  }

  private async load(): Promise<void> {
    if (!this.productId) return;
    this.loading.set(true);
    try {
      const data = await this.svc.getProductSalesByService(this.productId);
      this.rows.set(data);
    } catch (e) {
      console.error('[sales-by-service] load failed', e);
    } finally {
      this.loading.set(false);
      this.hasLoaded = true;
    }
  }
}
