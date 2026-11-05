import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal, viewChild } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';

import { LanguageService } from '@core/i18n/language.service';
import type { CanLeaveComponent } from '@core/guards/unsaved-changes.guard';
import { BreadcrumbsComponent } from '@shared/components/breadcrumbs/breadcrumbs.component';
import type { BreadcrumbItem } from '@shared/components/breadcrumbs/breadcrumbs.types';
import { FormStickyFooterComponent } from '@shared/components/form-sticky-footer/form-sticky-footer.component';
import { SearchDropdownComponent } from '@shared/components/dropdown/search-dropdown.component';
import { ToastService } from '@shared/components/toast/toast.service';
import { ModalService } from '@shared/modal/modal.service';
import { ConfirmModalComponent, ConfirmModalData } from '@shared/modal/demo/confirm-modal.component';
import { BranchSettingsService } from 'src/app/features/settings/services/branch-settings.service';

import { BUDGET_PERIODICITIES, Budget, BudgetAccount, BudgetPeriodicity } from '../../models/budget.model';
import { BudgetService } from '../../services/budget.service';
import { BudgetActions } from '../../services/budget-actions';
import { exportBudgetXlsx } from '../../services/budget-export';
import { num, periodColumns } from '../../services/budget-sheet';
import { BudgetSheetComponent, BudgetValues } from '../../components/budget-sheet/budget-sheet.component';

interface BranchOption { id: string; name: string; }
interface PeriodicityOption { value: BudgetPeriodicity; label: string; }

/**
 * Budget -> create / edit (`/account/budget/new`, `/account/budget/:id`). Legacy `BudgetFormComponent`: a title, branch,
 * year and periodicity, then - once a periodicity is chosen - the Profit & Loss / Balance Sheet grid with an amount per
 * account and period. Branch, year and periodicity are fixed once saved (the server's update only touches the title and
 * the amounts).
 */
@Component({
  selector: 'app-budget-form',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslateModule, BreadcrumbsComponent, FormStickyFooterComponent, SearchDropdownComponent, BudgetSheetComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './budget-form.component.html',
  styleUrl: './budget-form.component.scss',
})
export class BudgetFormComponent implements OnInit, CanLeaveComponent {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private location = inject(Location);
  private lang = inject(LanguageService);
  private toast = inject(ToastService);
  private modal = inject(ModalService);
  private service = inject(BudgetService);
  private branchSvc = inject(BranchSettingsService);
  readonly actions = inject(BudgetActions);

  private canGoBack = !!this.router.getCurrentNavigation()?.previousNavigation;
  private listParams: Record<string, any> = {};
  private dirty = false;
  /** Server ids of the saved cells (`accountId|period`), so a save updates them instead of adding duplicates. */
  private lineIds = new Map<string, string>();
  private budgetId = '';

  sheet = viewChild(BudgetSheetComponent);

  formStatus = signal<'new' | 'edit'>('new');
  loaded = signal(false);
  submitting = signal(false);
  showErrors = signal(false);
  breadcrumbs = signal<BreadcrumbItem[]>([]);

  name = signal('');
  branchId = signal('');
  year = signal<number | null>(new Date().getFullYear());
  periodicity = signal<BudgetPeriodicity | ''>('');
  branches = signal<BranchOption[]>([]);
  accounts = signal<BudgetAccount[]>([]);
  values = signal<BudgetValues>({});

  readonly periodicities: PeriodicityOption[] = BUDGET_PERIODICITIES.map(p => ({ value: p, label: this.lang.instant('BUDGET.PERIODICITY.' + p) }));
  periods = computed(() => periodColumns(this.periodicity(), this.year() ?? 0, k => this.lang.instant(k)));

  // ── dropdown plumbing ───────────────────────────────────────────────
  branchDisplay = (b: BranchOption | null) => b?.name ?? '';
  branchCompare = (a: BranchOption | null, b: BranchOption | null) => (a?.id ?? '') === (b?.id ?? '');
  branchToValue = (b: BranchOption | null) => b?.id ?? '';
  selectedBranch = (): BranchOption | null => this.branches().find(b => b.id === this.branchId()) ?? null;
  branchName = computed(() => this.branches().find(b => b.id === this.branchId())?.name ?? '');
  periodicityDisplay = (o: PeriodicityOption | null) => o?.label ?? '';
  periodicityCompare = (a: PeriodicityOption | null, b: PeriodicityOption | null) => a?.value === b?.value;
  periodicityToValue = (o: PeriodicityOption | null) => o?.value ?? '';
  selectedPeriodicity = (): PeriodicityOption | null => this.periodicities.find(o => o.value === this.periodicity()) ?? null;
  periodicityLabel = computed(() => this.periodicities.find(o => o.value === this.periodicity())?.label ?? '');

  // ── validation ──────────────────────────────────────────────────────
  nameError = computed(() => (this.showErrors() && !this.name().trim() ? this.lang.instant('BUDGET.FORM.REQUIRED') : null));
  branchError = computed(() => (this.showErrors() && this.formStatus() === 'new' && !this.branchId() ? this.lang.instant('BUDGET.FORM.REQUIRED') : null));
  periodicityError = computed(() => (this.showErrors() && this.formStatus() === 'new' && !this.periodicity() ? this.lang.instant('BUDGET.FORM.REQUIRED') : null));
  yearError = computed(() => {
    if (!this.showErrors()) return null;
    const y = this.year();
    return y != null && Number.isInteger(y) && y >= 1900 && y <= 2099 ? null : this.lang.instant('BUDGET.FORM.INVALID_YEAR');
  });

  async ngOnInit(): Promise<void> {
    const q = this.route.snapshot.queryParams;
    for (const k of ['pageNum', 'pageLimit', 'searchTerm']) if (q[k]) this.listParams[k] = q[k];

    const id = this.route.snapshot.paramMap.get('id');
    const isNew = !id || id === 'new' || id === '0';
    this.formStatus.set(isNew ? 'new' : 'edit');

    await this.loadBranches();
    if (isNew) {
      if (this.branches().length) this.branchId.set(this.branches()[0].id);
    } else {
      await this.load(id!);
    }

    const t = (k: string) => this.lang.instant(k);
    this.breadcrumbs.set([
      { label: t('BUDGET.DASHBOARD'), routerLink: '/dashboard' },
      { label: t('BUDGET.LIST.TITLE'), routerLink: '/account/budget' },
      { label: t(isNew ? 'BUDGET.FORM.NEW' : 'BUDGET.FORM.EDIT') },
    ]);
    this.loaded.set(true);
  }

  private async loadBranches(): Promise<void> {
    try {
      const res = await this.branchSvc.getList({ limit: 200 });
      this.branches.set(res.list.map((b: any) => ({ id: b.id, name: b.name })));
    } catch { /* the picker stays empty; the server rejects a budget without a branch */ }
  }

  private async load(id: string): Promise<void> {
    const b: Budget = await this.service.getBudget(id);
    this.budgetId = b.id;
    this.name.set(b.name);
    this.branchId.set(b.branchId ?? '');
    this.year.set(b.year);
    this.periodicity.set(b.periodicity);
    await this.loadAccounts();

    const values: BudgetValues = {};
    for (const l of b.lines) {
      (values[l.accountId] ??= {})[l.periodFilter] = String(l.prediction);
      if (l.id) this.lineIds.set(`${l.accountId}|${l.periodFilter}`, l.id);
    }
    this.values.set(values);
  }

  private async loadAccounts(): Promise<void> {
    if (this.accounts().length) return;
    try {
      this.accounts.set(await this.service.getAccountList());
    } catch (e: any) {
      this.toast.error('COMMON.OPS', e?.error?.msg ?? e?.message ?? '');
    }
  }

  hasUnsavedChanges(): boolean { return !this.submitting() && this.dirty; }

  markDirty(): void { this.dirty = true; }

  onName(v: string): void { this.name.set(v); this.dirty = true; }
  onBranch(v: BranchOption | BranchOption[] | null): void { const b = Array.isArray(v) ? v[0] : v; this.branchId.set(b?.id ?? ''); this.dirty = true; }

  /** A yearly budget's only period is the year itself, so a new year carries the typed amounts to it. */
  onYear(v: number | null): void {
    const prev = this.year();
    this.year.set(v);
    this.dirty = true;
    if (this.periodicity() !== 'yearly' || prev == null || v == null || prev === v) return;
    const from = String(prev), to = String(v);
    const moved: BudgetValues = {};
    for (const [acc, row] of Object.entries(this.values())) moved[acc] = from in row ? { [to]: row[from] } : { ...row };
    this.values.set(moved);
  }

  async onPeriodicity(v: PeriodicityOption | PeriodicityOption[] | null): Promise<void> {
    const o = Array.isArray(v) ? v[0] : v;
    const next = o?.value ?? '';
    if (next === this.periodicity()) return;
    const hasValues = Object.values(this.values()).some(r => Object.values(r).some(v => v !== ''));
    if (hasValues) {
      const ok = await this.modal.open<ConfirmModalComponent, ConfirmModalData, boolean>(ConfirmModalComponent, {
        size: 'sm',
        data: { title: this.lang.instant('BUDGET.FORM.RESET_TITLE'), message: this.lang.instant('BUDGET.FORM.RESET_MESSAGE'), danger: true },
      }).afterClosed();
      if (!ok) { this.periodicity.set(this.periodicity()); return; }
    }
    this.periodicity.set(next);
    this.values.set({});
    this.lineIds.clear();
    this.dirty = true;
    if (next) await this.loadAccounts();
  }

  /** The cells to save: every filled one, plus a saved one that was emptied (kept as 0 - the server never deletes a line). */
  private buildLines(): any[] {
    const lines: any[] = [];
    const accountIds = new Set(this.accounts().map(a => a.accountId));
    for (const [accountId, row] of Object.entries(this.values())) {
      if (!accountIds.has(accountId)) continue;
      for (const [periodFilter, text] of Object.entries(row)) {
        const id = this.lineIds.get(`${accountId}|${periodFilter}`);
        if (text === '' && !id) continue;
        lines.push({ ...(id ? { id } : {}), accountId, periodFilter, prediction: num(text), period: { from: '', to: '' } });
      }
    }
    return lines;
  }

  private get valid(): boolean {
    const y = this.year();
    const yearOk = y != null && Number.isInteger(y) && y >= 1900 && y <= 2099;
    const base = !!this.name().trim() && yearOk;
    if (!base) return false;
    if (this.formStatus() === 'new' && (!this.branchId() || !this.periodicity())) return false;
    return !this.sheet()?.hasErrors();
  }

  async save(): Promise<void> {
    if (this.submitting()) return;
    this.showErrors.set(true);
    if (this.sheet()?.hasErrors()) { this.toast.error('COMMON.OPS', this.lang.instant('BUDGET.FORM.DISCOUNT_MINUS')); return; }
    if (!this.valid) return;

    this.submitting.set(true);
    try {
      // Plain payload: the server fills `createdAt` itself, and a null one would be stored as-is.
      const res: any = await this.service.saveBudget({
        ...(this.budgetId ? { id: this.budgetId } : {}),
        name: this.name().trim(),
        branchId: this.branchId(),
        periodicity: this.periodicity(),
        year: this.year(),
        lines: this.buildLines(),
      } as unknown as Budget);
      if (res?.success) {
        this.dirty = false;
        this.toast.success('COMMON.SAVED_OK');
        this.goList();
      } else {
        this.toast.error('COMMON.OPS', typeof res === 'string' ? res : (res?.msg ?? res?.message ?? ''));
      }
    } catch (e: any) {
      this.toast.error('COMMON.OPS', e?.error?.msg ?? e?.message ?? '');
    } finally {
      this.submitting.set(false);
    }
  }

  exportSheets(): void {
    const s = this.sheet();
    if (s) exportBudgetXlsx(this.name().trim() || 'budget', s.exportSheets());
  }

  print(): void { window.print(); }

  cancel(): void {
    this.dirty = false;
    if (this.canGoBack) this.location.back(); else this.goList();
  }

  openReport(): void {
    this.dirty = false;
    void this.router.navigate(['/account/budget', this.budgetId, 'report'], { queryParams: this.listParams });
  }

  private goList(): void { void this.router.navigate(['/account/budget'], { queryParams: this.listParams }); }
}
