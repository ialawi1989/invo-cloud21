import { ChangeDetectionStrategy, Component, computed, inject, input, model, output, signal } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';

import { LanguageService } from '@core/i18n/language.service';
import { MycurrencyPipe } from '@core/pipes/mycurrency.pipe';
import { SegmentedToggleComponent, SegmentedToggleOption } from '@shared/components/segmented-toggle/segmented-toggle.component';

import { BudgetAccount, BudgetActualRow } from '../../models/budget.model';
import { PeriodCol, SheetKey, SheetRow, Spec, buildSheetRows, num, sheetParentTypes } from '../../services/budget-sheet';

/** Typed amounts as the user wrote them: account id -> period key -> text (kept as text so "1." survives while typing). */
export type BudgetValues = Record<string, Record<string, string>>;

/** The legacy account whose budget can only be a deduction. */
const DISCOUNT_ACCOUNT = 'Discount';

/**
 * The budget grid (legacy `budget-form` tables): a Profit & Loss and a Balance Sheet tab, accounts grouped by
 * section and account type with one column per period and a total. Edit mode has an input per account / period;
 * report mode (`report`) shows Budget and Actual per period instead, the actual coming from the booked journals.
 * Totals, gross / operating / net profit and the asset / liability lines are always computed from the cells.
 */
@Component({
  selector: 'app-budget-sheet',
  standalone: true,
  imports: [TranslateModule, MycurrencyPipe, SegmentedToggleComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './budget-sheet.component.html',
  styleUrl: './budget-sheet.component.scss',
})
export class BudgetSheetComponent {
  private lang = inject(LanguageService);

  accounts = input.required<BudgetAccount[]>();
  periods = input.required<PeriodCol[]>();
  /** Actual-vs-budget view: read-only, two columns per period. */
  report = input(false);
  values = model<BudgetValues>({});
  actual = input<BudgetActualRow[]>([]);
  changed = output<void>();

  sheet = signal<SheetKey>('pl');
  readonly tabs: SegmentedToggleOption<SheetKey>[] = [
    { value: 'pl', label: 'BUDGET.SHEET.PROFIT_LOSS' },
    { value: 'bs', label: 'BUDGET.SHEET.BALANCE_SHEET' },
  ];

  rows = computed<SheetRow[]>(() => buildSheetRows(this.sheet(), this.accounts(), (k, p) => this.lang.instant(k, p)));
  colCount = computed(() => 1 + (this.periods().length + 1) * (this.report() ? 2 : 1));

  // ── editing ──────────────────────────────────────────────────────────
  cell(accountId: string, period: string): string { return this.values()[accountId]?.[period] ?? ''; }

  setCell(accountId: string, period: string, raw: string): void {
    const all = this.values();
    this.values.set({ ...all, [accountId]: { ...(all[accountId] ?? {}), [period]: raw } });
    this.changed.emit();
  }

  isDiscount(a: BudgetAccount): boolean { return a.name === DISCOUNT_ACCOUNT; }

  /** A discount can only lower the budget ("minus values only"). */
  invalid(a: BudgetAccount, period: string): boolean { return this.isDiscount(a) && num(this.cell(a.accountId, period)) > 0; }

  hasErrors(): boolean {
    return this.accounts().some(a => this.isDiscount(a) && Object.values(this.values()[a.accountId] ?? {}).some(v => num(v) > 0));
  }

  // ── numbers ──────────────────────────────────────────────────────────
  /** Planned amount of one account in one period (`null` = across all periods). */
  private budgetOf(accountId: string, period: string | null): number {
    const row = this.values()[accountId] ?? {};
    return period == null ? Object.values(row).reduce((s, v) => s + num(v), 0) : num(row[period]);
  }

  private actualOf(accountId: string, period: string | null): number {
    return this.actual()
      .filter(r => r.accountId === accountId && (period == null || r.periodFilter === period))
      .reduce((s, r) => s + r.actualAmount, 0);
  }

  private budgetOfParent(parentType: string, period: string | null): number {
    return this.accounts().filter(a => a.parentType === parentType).reduce((s, a) => s + this.budgetOf(a.accountId, period), 0);
  }

  /** Legacy sums the booked rows of the parent type itself (not only the accounts listed), so totals match the books. */
  private actualOfParent(parentType: string, period: string | null): number {
    return this.actual()
      .filter(r => r.parentType === parentType && (period == null || r.periodFilter === period))
      .reduce((s, r) => s + r.actualAmount, 0);
  }

  accountTotal(accountId: string): number { return this.budgetOf(accountId, null); }

  /** Report cells of an account: budget / actual per period, then the totals. */
  accountCells(accountId: string): number[] {
    return this.cellsOf(p => this.budgetOf(accountId, p), p => this.actualOf(accountId, p));
  }

  /** Cells of a total / derived line, in column order (see {@link cellsOf}). */
  specCells(spec: Spec): number[] {
    const sum = (f: (parentType: string, p: string | null) => number) => (p: string | null) =>
      spec.terms.reduce((s, t) => s + t.sign * f(t.parentType, p), 0);
    return this.cellsOf(sum((t, p) => this.budgetOfParent(t, p)), sum((t, p) => this.actualOfParent(t, p)));
  }

  /** Per period the budget (and in report mode the actual), then the same for the total column. */
  private cellsOf(budget: (p: string | null) => number, actual: (p: string | null) => number): number[] {
    const keys: (string | null)[] = [...this.periods().map(p => p.key), null];
    return keys.flatMap(k => this.report() ? [budget(k), actual(k)] : [budget(k)]);
  }

  // ── export ───────────────────────────────────────────────────────────
  /** Both sheets as plain rows (header + lines), for the Excel export. */
  exportSheets(): { name: string; rows: (string | number)[][] }[] {
    const t = (k: string, p?: object) => this.lang.instant(k, p);
    const budgetLabel = t('BUDGET.SHEET.BUDGET');
    const actualLabel = t('BUDGET.SHEET.ACTUAL');
    return (['pl', 'bs'] as SheetKey[]).map(key => {
      const head: (string | number)[] = [t('BUDGET.SHEET.ACCOUNT')];
      for (const p of [...this.periods().map(x => x.label), t('BUDGET.SHEET.TOTAL')]) {
        head.push(this.report() ? `${p} - ${budgetLabel}` : p);
        if (this.report()) head.push(`${p} - ${actualLabel}`);
      }
      const out: (string | number)[][] = [head];
      const parents = sheetParentTypes(key);
      for (const r of buildSheetRows(key, this.accounts().filter(a => parents.includes(a.parentType)), t)) {
        if (r.kind === 'title' || r.kind === 'group') out.push([r.label]);
        else if (r.kind === 'account') {
          const cells = this.report() ? this.accountCells(r.account.accountId) : this.periods().map(p => this.budgetOf(r.account.accountId, p.key)).concat(this.budgetOf(r.account.accountId, null));
          out.push([r.account.name, ...cells]);
        } else out.push([r.label, ...this.specCells(r.spec)]);
      }
      return { name: t(key === 'pl' ? 'BUDGET.SHEET.PROFIT_LOSS' : 'BUDGET.SHEET.BALANCE_SHEET'), rows: out };
    });
  }
}
