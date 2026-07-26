import {
  ChangeDetectionStrategy, Component, computed, inject, signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';

import { CompanyService } from '@core/auth/company.service';
import {
  BranchSettingsService,
  BranchSummary,
} from '../../../settings/services/branch-settings.service';
import { WidgetFrameComponent } from '../../components/widget-frame/widget-frame.component';

/** A branch row with its resolved subscription status. */
interface BranchSubRow {
  id: string;
  name: string;
  endDate: string | null;
  /** Days until the subscription ends (negative = already expired). null = no end date. */
  daysLeft: number | null;
  status: 'active' | 'expiring' | 'expired' | 'none';
}

/**
 * Super-admin only: company & subscriptions overview.
 * ───────────────────────────────────────────────────
 * Surfaces the tenant-level details a super admin cares about that regular
 * roles never see — company identity plus each branch's subscription window
 * with an expiring/expired badge. Data is company-wide, so it ignores the
 * dashboard date filter (`scope: 'global'` in the registry).
 *
 * Gated in the registry via `superAdminOnly: true` — the dashboard only offers
 * and renders it when the viewer is a super admin.
 */
@Component({
  selector: 'app-admin-overview-widget',
  standalone: true,
  imports: [CommonModule, TranslateModule, WidgetFrameComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-widget-frame
      skeleton="table"
      [title]="title()"
      subtitle="DASHBOARD.W.COMPANY_OVERVIEW_SUB"
      [loading]="loading()"
      [error]="failed()"
      [empty]="isEmpty()"
      emptyText="DASHBOARD.AO_NO_BRANCHES"
      skeletonHeight="240px"
      (retry)="load()">

      <div class="ao">
        <div class="ao__company">
          <div class="ao__logo">
            @if (logo()) { <img [src]="logo()" alt="" /> }
            @else { <span>{{ initial() }}</span> }
          </div>
          <div class="ao__id">
            <div class="ao__name">{{ companyName() || ('DASHBOARD.AO_COMPANY' | translate) }}</div>
            <div class="ao__meta">
              <span>{{ 'DASHBOARD.AO_BRANCHES' | translate }}: <b>{{ rows().length }}</b></span>
              @if (expiringCount() > 0) {
                <span class="ao__chip ao__chip--warn">
                  {{ 'DASHBOARD.AO_EXPIRING_N' | translate:{ count: expiringCount() } }}
                </span>
              }
              @if (expiredCount() > 0) {
                <span class="ao__chip ao__chip--danger">
                  {{ 'DASHBOARD.AO_EXPIRED_N' | translate:{ count: expiredCount() } }}
                </span>
              }
            </div>
          </div>
        </div>

        <div class="ao__wrap">
          <table class="ao__table">
            <thead>
              <tr>
                <th>{{ 'DASHBOARD.AO_BRANCH' | translate }}</th>
                <th>{{ 'DASHBOARD.AO_ENDS' | translate }}</th>
                <th class="ao__status-col">{{ 'DASHBOARD.AO_STATUS' | translate }}</th>
              </tr>
            </thead>
            <tbody>
              @for (b of rows(); track b.id) {
                <tr>
                  <td class="ao__bname">{{ b.name || '—' }}</td>
                  <td class="ao__muted">{{ b.endDate ? (b.endDate | date:'mediumDate') : '—' }}</td>
                  <td>
                    <span class="ao__badge" [class]="'ao__badge--' + b.status">
                      @switch (b.status) {
                        @case ('active')   { {{ 'DASHBOARD.AO_ACTIVE' | translate }} }
                        @case ('expiring') { {{ 'DASHBOARD.AO_EXPIRING_IN' | translate:{ days: b.daysLeft } }} }
                        @case ('expired')  { {{ 'DASHBOARD.AO_EXPIRED' | translate }} }
                        @default           { {{ 'DASHBOARD.AO_NO_SUB' | translate }} }
                      }
                    </span>
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      </div>
    </app-widget-frame>
  `,
  styleUrl: './admin-overview.component.scss',
})
export class AdminOverviewWidgetComponent {
  private company  = inject(CompanyService);
  private branches = inject(BranchSettingsService);

  // Accepted to match the widget contract; company data is global so unused.
  readonly title = signal<string>('DASHBOARD.W.COMPANY_OVERVIEW');
  setTitle(t: string) { this.title.set(t); }

  readonly rows    = signal<BranchSubRow[]>([]);
  readonly loading = signal(true);
  readonly failed  = signal(false);
  readonly isEmpty = computed(() => this.rows().length === 0);

  readonly companyName = computed(() => this.company.currentCompanyName());
  readonly logo = computed<string>(() => {
    const s: any = this.company.settings();
    return s?.logo || s?.companyLogo || s?.image || '';
  });
  readonly initial = computed(() => (this.companyName() || '?').charAt(0).toUpperCase());

  readonly expiringCount = computed(() => this.rows().filter(r => r.status === 'expiring').length);
  readonly expiredCount  = computed(() => this.rows().filter(r => r.status === 'expired').length);

  constructor() {
    void this.load();
  }

  async load(): Promise<void> {
    this.loading.set(true);
    this.failed.set(false);
    try {
      const res = await this.branches.getList({ page: 1, limit: 1000, searchTerm: '' });
      this.rows.set(res.list.map((b) => this.toRow(b)));
    } catch {
      this.failed.set(true);
    } finally {
      this.loading.set(false);
    }
  }

  private toRow(b: BranchSummary): BranchSubRow {
    const end = b.endSubscriptionDate ?? null;
    let daysLeft: number | null = null;
    let status: BranchSubRow['status'] = 'none';
    if (end) {
      const ms = new Date(end).getTime() - Date.now();
      daysLeft = Math.ceil(ms / 86_400_000);
      status = daysLeft < 0 ? 'expired' : daysLeft <= 30 ? 'expiring' : 'active';
    }
    return { id: b.id, name: b.name, endDate: end, daysLeft, status };
  }
}
