import { ChangeDetectionStrategy, Component, OnInit, computed, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';

import { AuthService } from '@core/auth/auth.service';
import { PrivilegeService } from '@core/auth/privileges/privilege.service';

import { HR_LEAVE, hrModuleEnabled } from '../../employee-feature-flags';
import { hrGrantFor } from '../../hr-privilege';
import { EmployeeLeaveService, LeaveBalance, LeaveRequest } from '../../services/employee-leave.service';

const todayIso = () => new Date().toISOString().slice(0, 10);

/**
 * Leave at a glance: remaining days with a used/entitled bar, and the next
 * upcoming (pending or approved) leave. The balance is the SERVER's — remaining
 * counts pending requests too, exactly as the leave tab shows it.
 */
@Component({
  selector: 'app-employee-leave-summary',
  standalone: true,
  imports: [TranslateModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './employee-leave-summary.component.html',
  styleUrl: './employee-leave-summary.component.scss',
})
export class EmployeeLeaveSummaryComponent implements OnInit {
  private leave = inject(EmployeeLeaveService);
  private auth = inject(AuthService);
  private privileges = inject(PrivilegeService);
  private flag = hrModuleEnabled(HR_LEAVE);

  readonly employeeId = input.required<string>();

  readonly loading = signal(true);
  readonly balance = signal<LeaveBalance | null>(null);
  readonly upcoming = signal<LeaveRequest | null>(null);

  /** The leave tab is the one HR tab an employee may open on their own record. */
  readonly allowed = computed(() =>
    this.flag() && (
      (this.auth.currentEmployee as any)?.id === this.employeeId()
      || hrGrantFor(this.privileges, this.auth, 'employeeLeaveSecurity', 'view')));

  readonly total = computed(() => {
    const b = this.balance();
    return (b?.entitlementDays ?? 0) + (b?.openingBalance ?? 0) + (b?.carryOverDays ?? 0);
  });
  readonly usedPct = computed(() => {
    const t = this.total();
    return t > 0 ? Math.min(100, Math.round(((this.balance()?.usedDays ?? 0) / t) * 100)) : 0;
  });

  async ngOnInit(): Promise<void> {
    if (!this.allowed() || !this.employeeId()) { this.loading.set(false); return; }
    try {
      const [bal, reqs] = await Promise.all([
        this.leave.balance(this.employeeId()).catch(() => null),
        this.leave.requests(this.employeeId()).catch(() => [] as LeaveRequest[]),
      ]);
      this.balance.set(bal);
      const today = todayIso();
      const next = reqs
        .filter(r => (r.status === 'Approved' || r.status === 'Pending') && (r.endDate ?? '') >= today)
        .sort((a, b) => (a.startDate ?? '').localeCompare(b.startDate ?? ''))[0];
      this.upcoming.set(next ?? null);
    } finally {
      this.loading.set(false);
    }
  }
}
