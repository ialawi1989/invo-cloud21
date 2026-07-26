import {
  ChangeDetectionStrategy, Component, computed, inject, signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';

import { DashboardService } from '../../services/dashboard.service';
import { BranchSettingsService } from '../../../settings/services/branch-settings.service';
import { WidgetFrameComponent } from '../../components/widget-frame/widget-frame.component';

interface AlertRow {
  key: string;
  severity: 'danger' | 'warn' | 'info';
  labelKey: string;
  count: number;
}

/**
 * Attention / Alerts (super-admin only). A triage panel that aggregates the
 * red flags a super admin should act on — expired & soon-expiring branch
 * subscriptions, branches currently offline, and company-wide low stock —
 * from existing data (branch list + low-stock endpoint). Shows an "all clear"
 * state when nothing needs attention.
 */
@Component({
  selector: 'app-attention-alerts-widget',
  standalone: true,
  imports: [CommonModule, TranslateModule, WidgetFrameComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-widget-frame
      skeleton="table"
      [title]="title()"
      subtitle="DASHBOARD.AL_SUB"
      [loading]="loading()"
      [error]="failed()"
      skeletonHeight="200px"
      (retry)="load()">

      @if (alerts().length === 0) {
        <div class="al__clear">
          <span class="al__clearIcon" aria-hidden="true">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
          </span>
          <p>{{ 'DASHBOARD.AL_ALL_CLEAR' | translate }}</p>
        </div>
      } @else {
        <ul class="al__list">
          @for (a of alerts(); track a.key) {
            <li class="al__row" [class]="'al__row--' + a.severity">
              <span class="al__dot" aria-hidden="true"></span>
              <span class="al__label">{{ a.labelKey | translate }}</span>
              <span class="al__count">{{ a.count }}</span>
            </li>
          }
        </ul>
      }
    </app-widget-frame>
  `,
  styleUrl: './attention-alerts.component.scss',
})
export class AttentionAlertsWidgetComponent {
  private service  = inject(DashboardService);
  private branches = inject(BranchSettingsService);

  readonly title = signal<string>('DASHBOARD.W.ATTENTION');
  setTitle(t: string) { this.title.set(t); }

  readonly loading = signal(true);
  readonly failed  = signal(false);
  private readonly expired  = signal(0);
  private readonly expiring = signal(0);
  private readonly offline  = signal(0);
  private readonly lowStock = signal(0);

  readonly alerts = computed<AlertRow[]>(() => {
    const out: AlertRow[] = [];
    if (this.expired())  out.push({ key: 'expired',  severity: 'danger', labelKey: 'DASHBOARD.AL_EXPIRED_SUBS',  count: this.expired() });
    if (this.expiring()) out.push({ key: 'expiring', severity: 'warn',   labelKey: 'DASHBOARD.AL_EXPIRING_SUBS', count: this.expiring() });
    if (this.offline())  out.push({ key: 'offline',  severity: 'warn',   labelKey: 'DASHBOARD.AL_OFFLINE',       count: this.offline() });
    if (this.lowStock()) out.push({ key: 'lowstock', severity: 'info',   labelKey: 'DASHBOARD.AL_LOW_STOCK',     count: this.lowStock() });
    return out;
  });

  constructor() { void this.load(); }

  async load(): Promise<void> {
    this.loading.set(true);
    this.failed.set(false);
    try {
      const [branchRes, stock] = await Promise.all([
        this.branches.getList({ page: 1, limit: 1000, searchTerm: '' }),
        this.loadLowStockCount(),
      ]);
      let expired = 0, expiring = 0, offline = 0;
      for (const b of branchRes.list) {
        if (b.onlineAvailability === false) offline++;
        const end = b.endSubscriptionDate;
        if (end) {
          const days = Math.ceil((new Date(end).getTime() - Date.now()) / 86_400_000);
          if (days < 0) expired++;
          else if (days <= 30) expiring++;
        }
      }
      this.expired.set(expired);
      this.expiring.set(expiring);
      this.offline.set(offline);
      this.lowStock.set(stock);
    } catch {
      this.failed.set(true);
    } finally {
      this.loading.set(false);
    }
  }

  private loadLowStockCount(): Promise<number> {
    return new Promise((resolve) => {
      this.service.lowStock(null).subscribe({
        next: (rows) => resolve(Array.isArray(rows) ? rows.length : 0),
        error: () => resolve(0),
      });
    });
  }
}
