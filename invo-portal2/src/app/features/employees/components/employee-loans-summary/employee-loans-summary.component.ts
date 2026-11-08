import { ChangeDetectionStrategy, Component, OnInit, computed, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';

import { AuthService } from '@core/auth/auth.service';
import { PrivilegeService } from '@core/auth/privileges/privilege.service';
import { MycurrencyPipe } from '@core/pipes/mycurrency.pipe';

import { HR_PAYROLL, hrModuleEnabled } from '../../employee-feature-flags';
import { hrGrantFor } from '../../hr-privilege';
import { EmployeeLoan, EmployeePayrollService } from '../../services/employee-payroll.service';

/** Outstanding loans: total balance, next instalment, and how much is repaid. Needs `viewPay`. */
@Component({
  selector: 'app-employee-loans-summary',
  standalone: true,
  imports: [TranslateModule, RouterLink, MycurrencyPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './employee-loans-summary.component.html',
  styleUrl: './employee-loans-summary.component.scss',
})
export class EmployeeLoansSummaryComponent implements OnInit {
  private payroll = inject(EmployeePayrollService);
  private auth = inject(AuthService);
  private privileges = inject(PrivilegeService);
  private flag = hrModuleEnabled(HR_PAYROLL);

  readonly employeeId = input.required<string>();

  readonly loading = signal(true);
  readonly loans = signal<EmployeeLoan[]>([]);

  readonly allowed = computed(() =>
    this.flag() && hrGrantFor(this.privileges, this.auth, 'employeePayrollSecurity', 'viewPay'));

  readonly active = computed(() => this.loans().filter(l => !l.isSettled && (l.balance ?? 0) > 0));
  readonly balance = computed(() => this.active().reduce((s, l) => s + (l.balance ?? 0), 0));
  readonly instalment = computed(() => this.active().reduce((s, l) => s + (l.instalment ?? 0), 0));
  readonly repaidPct = computed(() => {
    const a = this.active();
    const amount = a.reduce((s, l) => s + (l.amount ?? 0), 0);
    const repaid = a.reduce((s, l) => s + (l.repaidAmount ?? 0), 0);
    return amount > 0 ? Math.min(100, Math.round((repaid / amount) * 100)) : 0;
  });

  async ngOnInit(): Promise<void> {
    if (!this.allowed() || !this.employeeId()) { this.loading.set(false); return; }
    try {
      this.loans.set(await this.payroll.loans(this.employeeId()).catch(() => []));
    } finally {
      this.loading.set(false);
    }
  }
}
