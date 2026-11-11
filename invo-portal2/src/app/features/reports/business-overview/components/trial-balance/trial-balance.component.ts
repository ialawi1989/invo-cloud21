import { Component, inject } from '@angular/core';
import { withTranslations } from '@core/i18n/with-translations';
import { findBoReport } from '../../config/business-overview.config';
import { BusinessOverviewService, StatementData } from '../../services/business-overview.service';
import { fillMissingColumns } from '../../shared/accounting.utils';
import { BoFilter } from '../../shared/bo-filter';
import { BoReportBase } from '../../shared/bo-report.base';
import { BoMatrixTableComponent, MatrixSection } from '../bo-matrix-table/bo-matrix-table.component';
import { BoStateComponent } from '../bo-state/bo-state.component';

/** Legacy section layout for the Trial Balance. */
const SECTIONS: MatrixSection[] = [
  { parentType: 'Assets', tone: 'asset', labelKey: 'REPORTS.BO.SECTIONS.ASSETS', childTypes: ['Current Assets', 'Other Current Assets', 'Fixed Assets'] },
  { parentType: 'Liabilities', tone: 'liability', labelKey: 'REPORTS.BO.SECTIONS.LIABILITIES', childTypes: ['Current Liabilities', 'Other Current Liabilities', 'Long Term Liabilities'] },
  { parentType: 'Equities', tone: 'equity', labelKey: 'REPORTS.BO.SECTIONS.EQUITY', childTypes: ['Equity'] },
  { parentType: 'Income', tone: 'income', labelKey: 'REPORTS.BO.SECTIONS.INCOME', childTypes: ['Operating Income', 'Other Income'] },
  { parentType: 'Costs Of Goods Sold', tone: 'expense', labelKey: 'REPORTS.BO.SECTIONS.COST_OF_GOODS_SOLD', childTypes: ['Costs Of Goods Sold'] },
  { parentType: 'Expense', tone: 'expense', labelKey: 'REPORTS.BO.SECTIONS.EXPENSES', childTypes: ['Operating Expense', 'Other Expense'] },
];

@Component({
  selector: 'app-bo-trial-balance',
  standalone: true,
  imports: [BoMatrixTableComponent, BoStateComponent],
  template: `
    <app-bo-state [loading]="loading() && !data()" [error]="error()" [empty]="loaded() && data()!.records.length === 0" (retry)="load()" />
    @if (data(); as d) {
      @if (d.records.length) {
        <div [style.opacity]="loading() ? .55 : 1">
          <app-bo-matrix-table [data]="d" [sections]="sections" [parens]="true" hintKey="boReports_trialBalance_hint" (open)="drill($event)" />
        </div>
      }
    }
  `,
})
export class TrialBalanceComponent extends BoReportBase<StatementData> {
  readonly cfg = findBoReport('trial-balance')!;
  readonly sections = SECTIONS;
  private svc = inject(BusinessOverviewService);

  constructor() {
    super();
    withTranslations('settings/chart-of-accounts');
  }

  protected fetch(f: BoFilter): Promise<StatementData> { return this.svc.statement(this.cfg, f); }
  protected override afterLoad(d: StatementData): void { fillMissingColumns(d.records, d.columns, d.subColumns); }
}
