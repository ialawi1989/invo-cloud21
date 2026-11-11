import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

import { ApiService } from '@core/http/api.service';
import { withTranslations } from '@core/i18n/with-translations';
import { PrivilegeService } from '@core/auth/privileges/privilege.service';
import { MathUtils } from '@core/math/math-helpers';
import { MycurrencyPipe } from '@core/pipes/mycurrency.pipe';
import { BreadcrumbsComponent } from '@shared/components/breadcrumbs/breadcrumbs.component';
import type { BreadcrumbItem } from '@shared/components/breadcrumbs/breadcrumbs.types';
import { LoadingOverlayComponent } from '@shared/components/spinner/loading-overlay.component';
import { ToastService } from '@shared/components/toast/toast.service';
import { ModalService } from '@shared/modal/modal.service';
import { ConfirmModalComponent, ConfirmModalData } from '@shared/modal/demo/confirm-modal.component';

import { EmployeePayoutService } from '../../services/employee-payout.service';

/** One employee payout: what it paid, from which account, and its journal. */
@Component({
  selector: 'app-employee-payout-view',
  standalone: true,
  imports: [CommonModule, TranslateModule, MycurrencyPipe, BreadcrumbsComponent, LoadingOverlayComponent],
  templateUrl: './employee-payout-view.component.html',
  styleUrl: '../earnings-pages.scss',
})
export class EmployeePayoutViewComponent implements OnInit {
  private route      = inject(ActivatedRoute);
  private router     = inject(Router);
  private service    = inject(EmployeePayoutService);
  private api        = inject(ApiService);
  private privileges = inject(PrivilegeService);
  private toast      = inject(ToastService);
  private modal      = inject(ModalService);
  private translate  = inject(TranslateService);

  readonly canEdit   = this.privileges.check('employeePayoutSecurity.actions.edit.access');
  readonly canDelete = this.privileges.check('employeePayoutSecurity.actions.delete.access');

  payout  = signal<any | null>(null);
  /** Rows of `accounts/getJournal/:id`: `{ accountType, debit, credit }`. */
  journal = signal<any[]>([]);
  busy    = signal(false);

  journalDebit  = computed(() => this.journal().reduce((s, r) => MathUtils.add(s, Number(r.debit ?? 0)), 0));
  journalCredit = computed(() => this.journal().reduce((s, r) => MathUtils.add(s, Number(r.credit ?? 0)), 0));

  breadcrumbs = computed<BreadcrumbItem[]>(() => [
    { label: this.translate.instant('MENU.EMPLOYEES'), routerLink: '/employees' },
    { label: this.translate.instant('MENU.SUB.EMPLOYEE_PAYOUTS'), routerLink: '/employees/payouts' },
    { label: this.translate.instant('EMPLOYEE_PAYOUT.PAYOUT') },
  ]);

  constructor() { withTranslations('employees'); }

  async ngOnInit(): Promise<void> {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) await this.load(id);
  }

  private async load(id: string): Promise<void> {
    this.busy.set(true);
    try {
      const res = await this.service.getEmployeePayout(id);
      if (!res?.success) {
        this.toast.error('COMMON.LOAD_FAILED', res?.msg);
        void this.router.navigate(['/employees/payouts']);
        return;
      }
      this.payout.set(res.data);
      const journal = await this.api.request<any>(this.api.get('accounts/getJournal/' + id));
      this.journal.set(journal?.data ?? []);
    } catch (e: any) {
      this.toast.error('COMMON.LOAD_FAILED', e?.message);
    } finally {
      this.busy.set(false);
    }
  }

  edit(): void { void this.router.navigate(['/employees/payouts', this.payout().id]); }
  back(): void { void this.router.navigate(['/employees/payouts']); }

  async remove(): Promise<void> {
    const ref = this.modal.open<ConfirmModalComponent, ConfirmModalData, boolean>(ConfirmModalComponent, {
      size: 'sm',
      data: {
        title: this.translate.instant('COMMON.DELETE'),
        message: this.translate.instant('EMPLOYEE_PAYOUT.DELETE_CONFIRM'),
        confirm: this.translate.instant('COMMON.DELETE'),
        danger: true,
      },
    });
    if (!(await ref.afterClosed())) return;

    this.busy.set(true);
    try {
      const res = await this.service.deleteEmployeePayout(this.payout().id);
      if (res?.success) {
        this.toast.success('COMMON.DELETED_OK');
        void this.router.navigate(['/employees/payouts']);
      } else {
        // A payout inside a closed accounting period can't be deleted; the server says why.
        this.toast.error('COMMON.DELETE_FAILED', res?.msg);
      }
    } catch (e: any) {
      this.toast.error('COMMON.DELETE_FAILED', e?.error?.msg ?? e?.message);
    } finally {
      this.busy.set(false);
    }
  }
}
