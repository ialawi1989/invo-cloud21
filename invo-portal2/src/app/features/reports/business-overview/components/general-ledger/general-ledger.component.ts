import { Component, inject } from '@angular/core';
import { withTranslations } from '@core/i18n/with-translations';
import { findBoReport } from '../../config/business-overview.config';
import { BusinessOverviewService, StatementData } from '../../services/business-overview.service';
import { fillMissingColumns } from '../../shared/accounting.utils';
import { BoFilter } from '../../shared/bo-filter';
import { BoReportBase } from '../../shared/bo-report.base';
import { BoMatrixTableComponent } from '../bo-matrix-table/bo-matrix-table.component';
import { BoStateComponent } from '../bo-state/bo-state.component';

@Component({
  selector: 'app-bo-general-ledger',
  standalone: true,
  imports: [BoMatrixTableComponent, BoStateComponent],
  template: `
    <app-bo-state [loading]="loading() && !data()" [error]="error()" [empty]="loaded() && data()!.records.length === 0" (retry)="load()" />
    @if (data(); as d) {
      @if (d.records.length) {
        <div [style.opacity]="loading() ? .55 : 1">
          <app-bo-matrix-table [data]="d" [parens]="false" hintKey="boReports_generalLedger_hint" (open)="drill($event)" />
        </div>
      }
    }
  `,
})
export class GeneralLedgerComponent extends BoReportBase<StatementData> {
  readonly cfg = findBoReport('general-ledger')!;
  private svc = inject(BusinessOverviewService);

  constructor() {
    super();
    withTranslations('settings/chart-of-accounts');
  }

  protected fetch(f: BoFilter): Promise<StatementData> { return this.svc.statement(this.cfg, f); }
  protected override afterLoad(d: StatementData): void { fillMissingColumns(d.records, d.columns, d.subColumns); }
}
