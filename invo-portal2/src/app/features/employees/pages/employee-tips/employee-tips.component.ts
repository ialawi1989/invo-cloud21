import { ChangeDetectorRef, Component, OnInit, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

import { withTranslations } from '@core/i18n/with-translations';
import { PrivilegeService } from '@core/auth/privileges/privilege.service';
import { MathUtils } from '@core/math/math-helpers';
import { MycurrencyPipe } from '@core/pipes/mycurrency.pipe';
import { BreadcrumbsComponent } from '@shared/components/breadcrumbs/breadcrumbs.component';
import type { BreadcrumbItem } from '@shared/components/breadcrumbs/breadcrumbs.types';
import { DateFieldComponent } from '@shared/components/date-field/date-field.component';
import { SearchDropdownComponent } from '@shared/components/dropdown/search-dropdown.component';
import { LoadingOverlayComponent } from '@shared/components/spinner/loading-overlay.component';
import { ToastService } from '@shared/components/toast/toast.service';
import { ModalService } from '@shared/modal/modal.service';
import { ConfirmModalComponent, ConfirmModalData } from '@shared/modal/demo/confirm-modal.component';

import { SalesLookupsService } from '../../../account/services/sales-lookups.service';
import { splitEvenly } from '../../models/employee-earnings.types';
import { EmployeeService } from '../../services/employee.service';
import { EmployeeTipsService } from '../../services/employee-tips.service';

interface Option { id: string; name: string }

const ymd = (d: Date) => {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

/**
 * Pool tips: split the General Pool tips of one branch and date range evenly between chosen employees, and undo a
 * split that hasn't been paid out. (`/employees/tips`)
 */
@Component({
  selector: 'app-employee-tips',
  standalone: true,
  imports: [
    CommonModule, FormsModule, TranslateModule, MycurrencyPipe,
    BreadcrumbsComponent, SearchDropdownComponent, DateFieldComponent, LoadingOverlayComponent,
  ],
  templateUrl: './employee-tips.component.html',
  styleUrl: '../earnings-pages.scss',
})
export class EmployeeTipsComponent implements OnInit {
  private service    = inject(EmployeeTipsService);
  private employeesApi = inject(EmployeeService);
  private lookups    = inject(SalesLookupsService);
  private privileges = inject(PrivilegeService);
  private toast      = inject(ToastService);
  private modal      = inject(ModalService);
  private translate  = inject(TranslateService);
  private cdr        = inject(ChangeDetectorRef);

  readonly historyLimit = 25;
  readonly canDistribute = this.privileges.check('tipsSecurity.actions.add.access');
  readonly canUndo       = this.privileges.check('tipsSecurity.actions.delete.access');

  branches: Option[] = [];
  employees: Option[] = [];

  branch: Option | null = null;
  fromDate: string | null = ymd(new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  toDate: string | null = ymd(new Date());
  distributionDate: string | null = ymd(new Date());
  /** In pick order: the rounding remainder goes to the first ones. */
  picked: Option[] = [];
  /** Bumped after each pick so the "add employee" dropdown starts empty again. */
  pickerKey = 0;

  poolRows: any[] = [];
  poolTotal = 0;
  /** The rows match the branch and range above; any change there requires reloading them. */
  poolLoaded = false;
  loadingPool = false;
  distributing = false;

  history: any[] = [];
  historyPage = 1;
  historyPageCount = 1;

  readonly breadcrumbs = computed<BreadcrumbItem[]>(() => [
    { label: this.translate.instant('MENU.EMPLOYEES'), routerLink: '/employees' },
    { label: this.translate.instant('TIPS.TITLE') },
  ]);

  readonly displayName = (o: Option) => o?.name ?? '';
  readonly sameId = (a: Option, b: Option) => a?.id === b?.id;

  constructor() { withTranslations('employees'); }

  /** Employees not picked yet. */
  get available(): Option[] { return this.employees.filter(e => !this.picked.some(p => p.id === e.id)); }

  /** Estimated shares, labelled as such: the server's split is final. */
  get preview(): { name: string; amount: number }[] {
    if (!this.poolLoaded || this.picked.length === 0) return [];
    const shares = splitEvenly(this.poolTotal, this.picked.length, MathUtils.afterDecimal);
    return this.picked.map((e, i) => ({ name: e.name, amount: shares[i] }));
  }

  async ngOnInit(): Promise<void> {
    const [employees, branches] = await Promise.all([
      this.employeesApi.getList({ page: 1, limit: 1000 }),
      this.lookups.getBranches(),
    ]);
    this.employees = (employees.list ?? []).map((e: any) => ({ id: e.id, name: e.name }));
    this.branches = (branches ?? []).map((b: any) => ({ id: b.id, name: b.name }));
    if (this.branches.length === 1) this.branch = this.branches[0];
    await this.loadHistory();
  }

  employeeName(id: string): string { return this.employees.find(e => e.id === id)?.name ?? id; }

  onRangeChange(): void {
    this.poolLoaded = false;
    this.poolRows = [];
    this.poolTotal = 0;
  }

  setBranch(b: Option | null): void { this.branch = b; this.onRangeChange(); }
  setFrom(v: string | null): void { this.fromDate = v; this.onRangeChange(); }
  setTo(v: string | null): void { this.toDate = v; this.onRangeChange(); }

  pick(e: Option | null): void {
    if (!e) return;
    this.picked = [...this.picked, e];
    this.pickerKey++;
  }
  unpick(e: Option): void { this.picked = this.picked.filter(p => p.id !== e.id); }

  async loadPool(): Promise<void> {
    if (!this.branch || !this.fromDate || !this.toDate) {
      this.toast.error('TIPS.ERRORS.RANGE_REQUIRED');
      return;
    }
    this.loadingPool = true;
    try {
      const res = await this.service.getUndistributedPoolTips({ branchId: this.branch.id, fromDate: this.fromDate, toDate: this.toDate });
      if (res?.success) {
        this.poolRows = res.data?.rows ?? [];
        this.poolTotal = res.data?.total ?? 0;
        this.poolLoaded = true;
      } else {
        this.toast.error('COMMON.LOAD_FAILED', res?.msg);
      }
    } catch (e: any) {
      this.toast.error('COMMON.LOAD_FAILED', e?.error?.msg ?? e?.message);
    } finally {
      this.loadingPool = false;
      this.cdr.markForCheck();
    }
  }

  async distribute(): Promise<void> {
    if (!this.poolLoaded) return this.fail('TIPS.ERRORS.LOAD_FIRST');
    if (this.picked.length === 0) return this.fail('TIPS.ERRORS.SELECT_EMPLOYEES');
    if (!this.distributionDate) return this.fail('TIPS.ERRORS.DATE_REQUIRED');

    this.distributing = true;
    try {
      const res = await this.service.distributePoolTips({
        branchId: this.branch!.id,
        fromDate: this.fromDate as string,
        toDate: this.toDate as string,
        distributionDate: this.distributionDate,
        employeeIds: this.picked.map(p => p.id),
      });
      if (res?.success) {
        this.toast.success('COMMON.SAVED_OK');
        this.picked = [];
        await Promise.all([this.loadPool(), this.loadHistory(1)]);
      } else {
        this.toast.error('COMMON.SAVE_FAILED', res?.msg);
      }
    } catch (e: any) {
      this.toast.error('COMMON.SAVE_FAILED', e?.error?.msg ?? e?.message);
    } finally {
      this.distributing = false;
      this.cdr.markForCheck();
    }
  }

  async loadHistory(page = this.historyPage): Promise<void> {
    this.historyPage = page;
    try {
      const res = await this.service.getTipDistributionsList({ page: this.historyPage, limit: this.historyLimit });
      if (res?.success) {
        this.history = res.data?.list ?? [];
        this.historyPageCount = res.data?.pageCount || 1;
      } else {
        this.toast.error('COMMON.LOAD_FAILED', res?.msg);
      }
    } catch (e: any) {
      this.toast.error('COMMON.LOAD_FAILED', e?.error?.msg ?? e?.message);
    }
    this.cdr.markForCheck();
  }

  prevHistoryPage(): void { if (this.historyPage > 1) void this.loadHistory(this.historyPage - 1); }
  nextHistoryPage(): void { if (this.historyPage < this.historyPageCount) void this.loadHistory(this.historyPage + 1); }

  async undo(distribution: any): Promise<void> {
    const ref = this.modal.open<ConfirmModalComponent, ConfirmModalData, boolean>(ConfirmModalComponent, {
      size: 'sm',
      data: {
        title: this.translate.instant('TIPS.UNDO'),
        message: this.translate.instant('TIPS.UNDO_CONFIRM'),
        confirm: this.translate.instant('TIPS.UNDO'),
        danger: true,
      },
    });
    if (!(await ref.afterClosed())) return;

    try {
      const res = await this.service.undoTipDistribution(distribution.id);
      if (res?.success) {
        this.toast.success('COMMON.DELETED_OK');
        await this.loadHistory();
        if (this.poolLoaded) await this.loadPool();
      } else {
        // e.g. "A share of this distribution has already been paid out".
        this.toast.error('COMMON.DELETE_FAILED', res?.msg);
      }
    } catch (e: any) {
      this.toast.error('COMMON.DELETE_FAILED', e?.error?.msg ?? e?.message);
    }
  }

  private fail(key: string): void { this.toast.error(key); }
}
