import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal, viewChild } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';

import { LanguageService } from '@core/i18n/language.service';
import { BreadcrumbsComponent } from '@shared/components/breadcrumbs/breadcrumbs.component';
import type { BreadcrumbItem } from '@shared/components/breadcrumbs/breadcrumbs.types';
import { ToastService } from '@shared/components/toast/toast.service';
import { BranchSettingsService } from 'src/app/features/settings/services/branch-settings.service';

import { Budget, BudgetAccount, BudgetActualRow } from '../../models/budget.model';
import { BudgetService } from '../../services/budget.service';
import { BudgetActions } from '../../services/budget-actions';
import { exportBudgetXlsx } from '../../services/budget-export';
import { periodColumns } from '../../services/budget-sheet';
import { BudgetSheetComponent, BudgetValues } from '../../components/budget-sheet/budget-sheet.component';

/**
 * Budget -> Budget vs Actual (`/account/budget/:id/report`). Legacy opened the budget form with `?report=true`: the same
 * grid, read-only, with the planned amounts from the budget and the actual from the booked journals side by side.
 */
@Component({
  selector: 'app-budget-report',
  standalone: true,
  imports: [CommonModule, TranslateModule, BreadcrumbsComponent, BudgetSheetComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './budget-report.component.html',
  styleUrl: './budget-report.component.scss',
})
export class BudgetReportComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private location = inject(Location);
  private lang = inject(LanguageService);
  private toast = inject(ToastService);
  private service = inject(BudgetService);
  private branchSvc = inject(BranchSettingsService);
  readonly actions = inject(BudgetActions);

  private canGoBack = !!this.router.getCurrentNavigation()?.previousNavigation;
  private listParams: Record<string, any> = {};

  sheet = viewChild(BudgetSheetComponent);

  loaded = signal(false);
  budget = signal<Budget | null>(null);
  branchName = signal('');
  accounts = signal<BudgetAccount[]>([]);
  actual = signal<BudgetActualRow[]>([]);
  values = signal<BudgetValues>({});
  breadcrumbs = signal<BreadcrumbItem[]>([]);

  periods = computed(() => {
    const b = this.budget();
    return b ? periodColumns(b.periodicity, b.year, k => this.lang.instant(k)) : [];
  });
  periodicityLabel = computed(() => {
    const p = this.budget()?.periodicity;
    return p ? this.lang.instant('BUDGET.PERIODICITY.' + p) : '';
  });

  async ngOnInit(): Promise<void> {
    const q = this.route.snapshot.queryParams;
    for (const k of ['pageNum', 'pageLimit', 'searchTerm']) if (q[k]) this.listParams[k] = q[k];
    const id = this.route.snapshot.paramMap.get('id')!;

    try {
      const [budget, accounts, actual] = await Promise.all([
        this.service.getBudget(id),
        this.service.getAccountList(),
        this.service.getActualVsPrediction(id),
      ]);
      this.budget.set(budget);
      this.accounts.set(accounts);
      this.actual.set(actual);

      const values: BudgetValues = {};
      for (const l of budget.lines) (values[l.accountId] ??= {})[l.periodFilter] = String(l.prediction);
      this.values.set(values);
      void this.loadBranchName(budget.branchId);
    } catch (e: any) {
      this.toast.error('COMMON.OPS', e?.error?.msg ?? e?.message ?? '');
    }

    const t = (k: string) => this.lang.instant(k);
    this.breadcrumbs.set([
      { label: t('BUDGET.DASHBOARD'), routerLink: '/dashboard' },
      { label: t('BUDGET.LIST.TITLE'), routerLink: '/account/budget' },
      { label: t('BUDGET.REPORT.TITLE') },
    ]);
    this.loaded.set(true);
  }

  private async loadBranchName(branchId: string | null): Promise<void> {
    if (!branchId) return;
    try {
      const res = await this.branchSvc.getList({ limit: 200 });
      this.branchName.set(res.list.find((b: any) => b.id === branchId)?.name ?? '');
    } catch { /* the branch line just stays blank */ }
  }

  print(): void { window.print(); }

  exportSheets(): void {
    const s = this.sheet();
    if (s) exportBudgetXlsx(this.budget()?.name || 'budget', s.exportSheets());
  }

  edit(): void {
    void this.router.navigate(['/account/budget', this.budget()!.id], { queryParams: this.listParams });
  }

  back(): void {
    if (this.canGoBack) this.location.back();
    else void this.router.navigate(['/account/budget'], { queryParams: this.listParams });
  }
}
