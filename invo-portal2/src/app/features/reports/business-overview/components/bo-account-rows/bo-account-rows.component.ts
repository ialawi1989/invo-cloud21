import { Component, computed, input, output, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  AccountGroupRow, ReportRecord, canDrillDown, groupByAnchor, groupKey, rowTotal, sumColumns, summaryValue,
} from '../../shared/accounting.utils';
import { BoAmountPipe } from '../../shared/pipes/bo-amount.pipe';
import { BoAccountNamePipe } from '../../shared/pipes/bo-account-name.pipe';
import { periodSlot } from '../bo-table-shell/bo-table-shell.component';

/**
 * The 2-level account tree used by Profit & Loss and the Balance Sheet:
 * a level-1 account with level-2 children renders a collapsible header
 * (collapsed → parent + children folded into one amount); a childless account
 * is a single line. Used as `<tbody boAccountRows …>` — several tbodies in one
 * table are valid HTML and keep the sticky columns aligned.
 */
@Component({
  selector: 'tbody[boAccountRows]',
  standalone: true,
  imports: [RouterLink, BoAmountPipe, BoAccountNamePipe],
  templateUrl: './bo-account-rows.component.html',
})
export class BoAccountRowsComponent {
  childs = input<ReportRecord[]>([]);
  columns = input<string[]>([]);
  /** Account names link to Account Journals. */
  drill = input(true);
  /** Balance Sheet only: link for the "Current Year Net Profit" line. */
  profitLoss = input<{ commands: any[]; queryParams: Record<string, string> } | null>(null);

  open = output<ReportRecord>();

  groups = computed(() => groupByAnchor(this.childs(), this.columns()));
  private collapsed = signal<ReadonlySet<string>>(new Set());

  readonly slot = periodSlot;
  readonly value = summaryValue;
  readonly total = rowTotal;
  readonly key = groupKey;

  showTotal = computed(() => this.columns().length > 1);
  headerTotal = (g: AccountGroupRow) => sumColumns(g.header, this.columns());

  isCollapsed = (g: AccountGroupRow, i: number) => this.collapsed().has(groupKey(g, i));

  toggle(g: AccountGroupRow, i: number, e: Event): void {
    e.preventDefault();
    e.stopPropagation();
    const k = groupKey(g, i);
    const next = new Set(this.collapsed());
    next.has(k) ? next.delete(k) : next.add(k);
    this.collapsed.set(next);
  }

  linkable = (r: ReportRecord) => this.drill() && canDrillDown(r);
  isRetained = (r: ReportRecord) => r.account?.toLowerCase() === 'retained earning';
  isNetProfit = (r: ReportRecord) => r.account?.toLowerCase() === 'current year net profit';

  go(r: ReportRecord, e: Event): void {
    e.preventDefault();
    this.open.emit(r);
  }
}
