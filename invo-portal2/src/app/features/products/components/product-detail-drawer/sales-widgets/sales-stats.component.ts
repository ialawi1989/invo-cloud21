import { Component, HostBinding, Input, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { MycurrencyPipe, MynumberPipe } from '../../../../../core/pipes';
import { ProductsService, ProductSalesStats } from '../../../services/products.service';
import { VisibleDirective } from '../../../../../shared/directives/visible.directive';

/**
 * Sales KPI strip for the Sales tab. Three cards: Sales Figure / Total Sales
 * / Units Sold, each showing a value + percent change vs. last month with an
 * up/down arrow and a colour-coded pill (green / red / neutral).
 */
@Component({
  selector: 'app-sales-stats',
  standalone: true,
  imports: [CommonModule, TranslateModule, MycurrencyPipe, MynumberPipe],
  hostDirectives: [VisibleDirective],
  template: `
    <p class="intro">{{ 'PRODUCTS.SALES.STATS_INTRO' | translate }}</p>

    @if (loading() || !hasLoaded) {
      <div class="grid">
        @for (i of [1,2,3]; track i) {
          <div class="kpi kpi--skel">
            <div class="skeleton w-40"></div>
            <div class="skeleton w-60 lg"></div>
            <div class="skeleton w-50"></div>
          </div>
        }
      </div>
    } @else if (!stats()) {
      <div class="empty">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="36" height="36">
          <path stroke-linecap="round" stroke-linejoin="round" d="M3 3v18h18M7 14l4-4 4 4 5-5"/>
        </svg>
        <p>{{ 'PRODUCTS.SALES.NO_STATS' | translate }}</p>
      </div>
    } @else {
      <div class="grid">
        <!-- Sales Figure -->
        <div class="kpi" [attr.data-trend]="trend(stats()!.sales_figure_change_pct)">
          <div class="kpi-label">{{ 'PRODUCTS.SALES.SALES_FIGURE' | translate }}</div>
          <div class="kpi-value">{{ stats()!.sales_figure | mycurrency }}</div>
          <div class="kpi-change">
            @if (stats()!.sales_figure_change_pct == null || stats()!.sales_figure_change_pct === 0) {
              <span class="muted">{{ 'PRODUCTS.SALES.NO_CHANGE' | translate }}</span>
            } @else {
              <span class="arrow">{{ arrow(stats()!.sales_figure_change_pct) }}</span>
              <span>{{ formatPct(stats()!.sales_figure_change_pct) }}</span>
              <span class="muted">{{ 'PRODUCTS.SALES.FROM_LAST_MONTH' | translate }}</span>
            }
          </div>
        </div>

        <!-- Total Sales -->
        <div class="kpi" [attr.data-trend]="trend(stats()!.total_sales_change_pct)">
          <div class="kpi-label">{{ 'PRODUCTS.SALES.TOTAL_SALES' | translate }}</div>
          <div class="kpi-value">{{ stats()!.total_sales | mycurrency }}</div>
          <div class="kpi-change">
            @if (stats()!.total_sales_change_pct == null || stats()!.total_sales_change_pct === 0) {
              <span class="muted">{{ 'PRODUCTS.SALES.NO_CHANGE' | translate }}</span>
            } @else {
              <span class="arrow">{{ arrow(stats()!.total_sales_change_pct) }}</span>
              <span>{{ formatPct(stats()!.total_sales_change_pct) }}</span>
              <span class="muted">{{ 'PRODUCTS.SALES.FROM_LAST_MONTH' | translate }}</span>
            }
          </div>
        </div>

        <!-- Units Sold -->
        <div class="kpi" [attr.data-trend]="trend(stats()!.units_sold_change_pct)">
          <div class="kpi-label">{{ 'PRODUCTS.SALES.UNITS_SOLD' | translate }}</div>
          <div class="kpi-value">{{ stats()!.units_sold | mynumber }}</div>
          <div class="kpi-change">
            @if (stats()!.units_sold_change_pct == null || stats()!.units_sold_change_pct === 0) {
              <span class="muted">{{ 'PRODUCTS.SALES.NO_CHANGE' | translate }}</span>
            } @else {
              <span class="arrow">{{ arrow(stats()!.units_sold_change_pct) }}</span>
              <span>{{ formatPct(stats()!.units_sold_change_pct) }}</span>
              <span class="muted">{{ 'PRODUCTS.SALES.FROM_LAST_MONTH' | translate }}</span>
            }
          </div>
        </div>
      </div>
    }
  `,
  styles: [`
    :host { display: block; min-height: 120px; }
    :host(.loaded) { min-height: 0; }
    .intro { font-size:13px; color:#64748b; margin:0 0 12px; }
    .empty {
      display:flex; flex-direction:column; align-items:center; justify-content:center;
      gap:8px; padding:32px 20px; color:#94a3b8;
      background:#fff; border:1px dashed #e2e8f0; border-radius:10px;
    }
    .empty svg { opacity:.5; }
    .empty p { margin:0; font-size:13px; }

    .grid {
      display:grid; gap:12px;
      grid-template-columns: repeat(3, 1fr);
    }
    @media (max-width: 900px) {
      .grid { grid-template-columns: 1fr 1fr; }
    }
    @media (max-width: 560px) {
      .grid { grid-template-columns: 1fr; }
    }

    .kpi {
      background:#fff; border:1px solid #e2e8f0; border-radius:10px;
      padding:14px;
      display:flex; flex-direction:column; gap:6px;
    }
    .kpi[data-trend="up"]      { background:#f0fdf4; border-color:#bbf7d0; }
    .kpi[data-trend="down"]    { background:#fef2f2; border-color:#fecaca; }
    .kpi[data-trend="neutral"] { background:#eff6ff; border-color:#bfdbfe; }

    .kpi-label { font-size:12px; font-weight:600; color:#475569; }
    .kpi-value { font-size:22px; font-weight:700; color:#0f172a; font-variant-numeric:tabular-nums; }
    .kpi-change {
      display:flex; align-items:center; gap:6px;
      font-size:12px; font-weight:500;
    }
    .kpi[data-trend="up"]      .kpi-change { color:#15803d; }
    .kpi[data-trend="down"]    .kpi-change { color:#b91c1c; }
    .kpi[data-trend="neutral"] .kpi-change { color:#1d4ed8; }
    .arrow { font-size:14px; line-height:1; }
    .muted { color:#64748b; font-weight:400; }

    /* Skeletons */
    .kpi--skel { gap:10px; }
    @keyframes skel-shimmer { 0%{background-position:-200% 0;} 100%{background-position:200% 0;} }
    .skeleton {
      height:12px;
      background: linear-gradient(90deg,#e2e8f0 0%,#f1f5f9 50%,#e2e8f0 100%);
      background-size:200% 100%;
      animation: skel-shimmer 1.4s ease-in-out infinite;
      border-radius:6px;
    }
    .skeleton.lg { height:22px; }
    .w-40 { width:40%; } .w-50 { width:50%; } .w-60 { width:60%; }
  `],
})
export class SalesStatsComponent implements OnInit {
  @Input() productId: string | null = null;

  private svc = inject(ProductsService);
  private visibility = inject(VisibleDirective);

  hasLoaded = false;
  @HostBinding('class.loaded') get loadedClass() { return this.hasLoaded; }
  loading = signal(false);
  stats   = signal<ProductSalesStats | null>(null);

  ngOnInit(): void {
    this.visibility.visible.subscribe(() => {
      if (!this.hasLoaded) this.load();
    });
  }

  private async load(): Promise<void> {
    if (!this.productId) return;
    this.loading.set(true);
    try {
      const data = await this.svc.getProductStats(this.productId);
      this.stats.set(data);
    } catch (e) {
      console.error('[sales-stats] load failed', e);
    } finally {
      this.loading.set(false);
      this.hasLoaded = true;
    }
  }

  trend(pct: number | null | undefined): 'up' | 'down' | 'neutral' {
    if (pct == null || pct === 0) return 'neutral';
    return pct > 0 ? 'up' : 'down';
  }

  arrow(pct: number | null | undefined): string {
    if (pct == null || pct === 0) return '→';
    return pct > 0 ? '↗' : '↘';
  }

  formatPct(pct: number | null | undefined): string {
    if (pct == null) return '0%';
    const sign = pct > 0 ? '+' : '';
    return `${sign}${pct.toFixed(1)}%`;
  }
}
