import { Component, computed, input, output } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';
import { MycurrencyPipe } from '@core/pipes/mycurrency.pipe';
import { StatementData } from '../../services/business-overview.service';
import {
  ReportRecord, canDrillDown, summarySubValue, summaryValue, totalsOf, totalsWithSub,
} from '../../shared/accounting.utils';
import { BoAmountPipe } from '../../shared/pipes/bo-amount.pipe';
import { BoAccountNamePipe } from '../../shared/pipes/bo-account-name.pipe';
import { BoColumnPipe } from '../../shared/pipes/bo-column.pipe';
import { BoTableShellComponent, periodSlot } from '../bo-table-shell/bo-table-shell.component';

export interface MatrixSection {
  parentType: string;
  labelKey: string;
  /** Record `parentType` values listed under this section. */
  childTypes: string[];
  /** Colour accent for the section row (see the common report theme). */
  tone?: 'income' | 'expense' | 'profit' | 'asset' | 'liability' | 'equity';
}

interface RenderSection { key: string; tone: string | null; labelKey: string | null; label: string | null; records: ReportRecord[]; }

/**
 * Account × (column [× sub-column]) matrix shared by the Trial Balance and the
 * General Ledger: sticky account/code columns, optional two-row header for
 * sub-columns (Net Debit / Net Credit), optional section grouping, and a grand
 * total row.
 */
@Component({
  selector: 'app-bo-matrix-table',
  standalone: true,
  imports: [TranslateModule, BoAccountNamePipe, BoColumnPipe, BoTableShellComponent],
  templateUrl: './bo-matrix-table.component.html',
})
export class BoMatrixTableComponent {
  data = input.required<StatementData>();
  /** Group rows into these sections (Trial Balance). Omit for a flat list (General Ledger). */
  sections = input<MatrixSection[] | null>(null);
  /** Negative amounts: `(1,200)` or `-1,200`. */
  parens = input(true);
  drill = input(true);
  hintKey = input('boReports_matrix_hint');

  open = output<ReportRecord>();

  private cur = new MycurrencyPipe();
  private amt = new BoAmountPipe();

  readonly slot = periodSlot;
  readonly sub = summarySubValue;
  readonly val = summaryValue;

  columns = computed(() => this.data().columns);
  subColumns = computed(() => this.data().subColumns);
  hasSub = computed(() => this.subColumns().length > 0);
  periods = computed(() => this.columns().filter(c => c !== 'Total'));
  /** Total number of value columns (for section-row colspans). */
  valueCols = computed(() => this.columns().length * (this.hasSub() ? this.subColumns().length : 1));

  fmt = (v: number): string => (this.parens() ? this.amt.transform(v) : this.cur.transform(v));
  linkable = (r: ReportRecord) => this.drill() && canDrillDown(r);

  renderSections = computed<RenderSection[]>(() => {
    const d = this.data();
    const cfg = this.sections();
    if (!cfg) return [{ key: 'all', tone: null, labelKey: null, label: null, records: d.records }];

    const used = new Set<string>();
    const out: RenderSection[] = [];
    for (const s of cfg) {
      const records = d.records.filter(r => r.parentType != null && s.childTypes.includes(r.parentType));
      s.childTypes.forEach(t => used.add(t));
      if (records.length) out.push({ key: s.parentType, tone: s.tone ?? null, labelKey: s.labelKey, label: null, records });
    }
    // Rows whose parent type isn't listed would otherwise vanish while still counting in the total.
    const rest = d.records.filter(r => !used.has(r.parentType ?? 'Unknown'));
    if (rest.length) out.push({ key: '__other', tone: null, labelKey: 'REPORTS.BO.SECTIONS.OTHER', label: null, records: rest });
    return out;
  });

  isEmpty = computed(() => this.data().records.length === 0);

  /** Grand total — per column, or per column × sub-column. */
  plainTotals = computed(() => totalsOf(this.data().records, this.columns()));
  subTotals = computed(() => totalsWithSub(this.data().records, this.columns(), this.subColumns()));
}
