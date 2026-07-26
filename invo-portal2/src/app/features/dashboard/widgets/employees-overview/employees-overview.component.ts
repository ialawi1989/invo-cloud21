import {
  ChangeDetectionStrategy, Component, computed, inject, signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';

import { EmployeeService } from '../../../employees/services/employee.service';
import { WidgetFrameComponent } from '../../components/widget-frame/widget-frame.component';

/**
 * Employees overview (super-admin only) — headcount plus a breakdown by role
 * flag (cloud admins, POS users, drivers, super admins, pending invites).
 * Governance at a glance; data from the existing employee list endpoint.
 */
@Component({
  selector: 'app-employees-overview-widget',
  standalone: true,
  imports: [CommonModule, TranslateModule, WidgetFrameComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-widget-frame
      skeleton="kpi"
      [title]="title()"
      subtitle="DASHBOARD.EO_SUB"
      [loading]="loading()"
      [error]="failed()"
      skeletonHeight="130px"
      (retry)="load()">

      <div class="eo">
        <div class="eo__total">
          <div class="eo__totalValue">{{ total() }}</div>
          <div class="eo__totalLabel">{{ 'DASHBOARD.EO_TOTAL' | translate }}</div>
        </div>
        <div class="eo__grid">
          <div class="eo__chip"><b>{{ cloudAdmins() }}</b><span>{{ 'DASHBOARD.EO_CLOUD_ADMINS' | translate }}</span></div>
          <div class="eo__chip"><b>{{ posUsers() }}</b><span>{{ 'DASHBOARD.EO_POS_USERS' | translate }}</span></div>
          <div class="eo__chip"><b>{{ drivers() }}</b><span>{{ 'DASHBOARD.EO_DRIVERS' | translate }}</span></div>
          <div class="eo__chip"><b>{{ superAdmins() }}</b><span>{{ 'DASHBOARD.EO_SUPER_ADMINS' | translate }}</span></div>
          @if (invited()) {
            <div class="eo__chip eo__chip--muted"><b>{{ invited() }}</b><span>{{ 'DASHBOARD.EO_INVITED' | translate }}</span></div>
          }
        </div>
      </div>
    </app-widget-frame>
  `,
  styleUrl: './employees-overview.component.scss',
})
export class EmployeesOverviewWidgetComponent {
  private service = inject(EmployeeService);

  readonly title = signal<string>('DASHBOARD.W.EMPLOYEES_OVERVIEW');
  setTitle(t: string) { this.title.set(t); }

  readonly loading = signal(true);
  readonly failed  = signal(false);

  readonly total       = signal(0);
  readonly cloudAdmins = signal(0);
  readonly posUsers    = signal(0);
  readonly drivers     = signal(0);
  readonly superAdmins = signal(0);
  readonly invited     = signal(0);

  constructor() { void this.load(); }

  async load(): Promise<void> {
    this.loading.set(true);
    this.failed.set(false);
    try {
      const res = await this.service.getList({ page: 1, limit: 1000, searchTerm: '' });
      const list = res.list;
      this.total.set(res.count || list.length);
      this.cloudAdmins.set(list.filter((e) => e.admin).length);
      this.posUsers.set(list.filter((e) => e.user).length);
      this.drivers.set(list.filter((e) => e.isDriver).length);
      this.superAdmins.set(list.filter((e) => e.superAdmin).length);
      this.invited.set(list.filter((e) => e.isInvitedUser).length);
    } catch {
      this.failed.set(true);
    } finally {
      this.loading.set(false);
    }
  }
}
