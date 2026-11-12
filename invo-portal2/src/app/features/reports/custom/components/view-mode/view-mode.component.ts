import { Component, Input, Output, EventEmitter, OnInit, DoCheck } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NgSelectModule } from '@ng-select/ng-select';
import {
  SheetConfig,
  FlatField,
  FilterRule,
  ColumnFormat,
  FILTER_OPERATORS,
  operatorsForType,
} from '../../shared/models/custom-report.model';
import { ChartPreviewComponent } from '../chart-preview/chart-preview.component';
import { PaginationComponent } from '../pagination/pagination.component';

import { TranslateModule } from '@ngx-translate/core';
@Component({
  selector: 'app-view-mode',
  standalone: true,
  imports: [TranslateModule, CommonModule, FormsModule, NgSelectModule, ChartPreviewComponent, PaginationComponent],
  templateUrl: './view-mode.component.html',
  styleUrls: ['./view-mode.component.scss'],
})
export class ViewModeComponent implements OnInit, DoCheck {
  @Input() sheet!: SheetConfig;
  @Input() data: any[] = [];
  @Input() loading = false;
  @Input() allFields: FlatField[] = [];
  @Input() fieldOptions: { [fieldId: string]: any[] } = {};
  @Input() dimKey: string | null = null;
  @Input() measKeys: string[] = [];
  @Input() colorField: string | null = null;
  @Input() columnLabels: { [key: string]: string } = {};
  @Input() orderedColumns: string[] = [];
  // Rich rendering inputs (currency/format, types, grouping) — forwarded to
  // chart-preview so the read-only view matches the builder's edit preview.
  @Input() columnFormats: { [key: string]: ColumnFormat } = {};
  @Input() columnTypes: { [key: string]: string } = {};
  @Input() columnNumberFormats: { [key: string]: string } = {};
  @Input() showDataLabels: boolean | null = null;
  @Input() currentSort: { key: string; dir: 'ASC' | 'DESC' } | null = null;
  @Input() groupedData: { value: any; count: number; len: number; subtotals: { [key: string]: number } }[] | null = null;
  @Input() groupFieldLabel = '';
  @Input() groupByKey: string | null = null;
  /** hasNext cursor pagination — forwarded to the pagination control. */
  @Input() hasNext = false;
  /** Rows on the current page, for the pagination range label. */
  @Input() rowCount = 0;
  @Output() run = new EventEmitter<{ filters: FilterRule[]; glue: string; page: number; pageSize: number }>();
  @Output() pageChange = new EventEmitter<number>();
  @Output() pageSizeChange = new EventEmitter<number>();
  @Output() loadOptions = new EventEmitter<string>();

  filterOperators = FILTER_OPERATORS;

  /** Per-rule operator list filtered to those that make sense for the
   *  rule's column type (text / number / date / boolean). Falls back to
   *  the full list for unknown types. Template-safe — pure lookup, no
   *  state mutation. */
  operatorsForRule(rule: FilterRule): typeof FILTER_OPERATORS {
    return operatorsForType(rule?.type);
  }
  pendingFilters: FilterRule[] = [];
  pendingGlue = ' AND ';
  hasPendingChanges = false;

  /** Period shortcuts offered next to a date `between` filter. `custom` is not
   *  a range of its own — it is what the dropdown shows once the two dates stop
   *  matching any shortcut, so picking it leaves the dates untouched. */
  readonly datePresets: { value: string; label: string }[] = [
    { value: 'today',       label: 'CUSTOM_REPORTS.VIEW.PERIOD.TODAY' },
    { value: 'yesterday',   label: 'CUSTOM_REPORTS.VIEW.PERIOD.YESTERDAY' },
    { value: 'thisWeek',    label: 'CUSTOM_REPORTS.VIEW.PERIOD.THIS_WEEK' },
    { value: 'lastWeek',    label: 'CUSTOM_REPORTS.VIEW.PERIOD.LAST_WEEK' },
    { value: 'thisMonth',   label: 'CUSTOM_REPORTS.VIEW.PERIOD.THIS_MONTH' },
    { value: 'lastMonth',   label: 'CUSTOM_REPORTS.VIEW.PERIOD.LAST_MONTH' },
    { value: 'thisQuarter', label: 'CUSTOM_REPORTS.VIEW.PERIOD.THIS_QUARTER' },
    { value: 'thisYear',    label: 'CUSTOM_REPORTS.VIEW.PERIOD.THIS_YEAR' },
    { value: 'lastYear',    label: 'CUSTOM_REPORTS.VIEW.PERIOD.LAST_YEAR' },
    { value: 'custom',      label: 'CUSTOM_REPORTS.VIEW.PERIOD.CUSTOM' },
  ];

  private syncedRules: FilterRule[] | null = null;
  private syncedGlue: string | null = null;

  ngOnInit(): void {
    this.syncPendingFromSheet();
  }

  // The saved sheet can arrive (or be replaced after a save) once this view
  // already exists, so a one-off copy in ngOnInit would leave the filters empty.
  // Re-copy whenever the sheet's filters change, unless the user has unapplied edits.
  ngDoCheck(): void {
    if (this.hasPendingChanges) return;
    if (this.sheet?.filterRules !== this.syncedRules || this.sheet?.filterGlue !== this.syncedGlue) {
      this.syncPendingFromSheet();
    }
  }

  private syncPendingFromSheet(): void {
    if (!this.sheet) return;
    this.syncedRules = this.sheet.filterRules;
    this.syncedGlue = this.sheet.filterGlue;
    this.pendingFilters = (this.sheet.filterRules || []).map(r => ({ ...r, condition: { ...r.condition } }));
    this.pendingGlue = this.sheet.filterGlue;
  }

  // ─── Filter management ────────────────────────────────

  addFilter(): void {
    this.pendingFilters = [
      ...this.pendingFilters,
      { field: '', type: 'text', condition: { type: 'equal', filter: '' }, includes: [] },
    ];
    this.hasPendingChanges = true;
  }

  removeFilter(index: number): void {
    this.pendingFilters = this.pendingFilters.filter((_, i) => i !== index);
    this.hasPendingChanges = true;
  }

  updateFilterField(index: number, field: string): void {
    const f = this.allFields.find(x => x.fullId === field);
    const isFormula = !!f?.isFormula;
    this.pendingFilters = this.pendingFilters.map((r, i) =>
      i === index ? { ...r, field, type: f?.type || 'text', isFormula, condition: { ...r.condition, filter: '' } } : r
    );
    this.hasPendingChanges = true;
    // Lazy-load options for FK fields (formulas have no distinct-value list).
    if (!isFormula && field.endsWith('Id')) {
      this.loadOptions.emit(field);
    }
  }

  updateFilterOp(index: number, op: string): void {
    let newFilter: any = '';
    if (op === 'between') newFilter = { start: '', end: '' };
    if (op === 'isEmpty' || op === 'isNotEmpty') newFilter = '__none__';
    this.pendingFilters = this.pendingFilters.map((r, i) =>
      i === index ? { ...r, condition: { type: op, filter: newFilter } } : r
    );
    this.hasPendingChanges = true;
  }

  updateFilterValue(index: number, val: string): void {
    const rule = this.pendingFilters[index];
    let finalVal: string = val;
    if (rule && rule.type === 'date' && val && !val.includes('T')) {
      try { finalVal = new Date(val + 'T00:00:00.000Z').toISOString(); } catch { finalVal = val; }
    }
    this.pendingFilters = this.pendingFilters.map((r, i) =>
      i === index ? { ...r, condition: { ...r.condition, filter: finalVal } } : r
    );
    this.hasPendingChanges = true;
  }

  updateBetweenStart(index: number, val: string): void {
    const rule = this.pendingFilters[index];
    if (!rule) return;
    let iso = val;
    if (rule.type === 'date' && val && !val.includes('T')) {
      try { iso = new Date(val + 'T00:00:00.000Z').toISOString(); } catch {}
    }
    const current = rule.condition.filter;
    const obj = typeof current === 'object' && current !== null ? current : { start: '', end: '' };
    this.pendingFilters = this.pendingFilters.map((r, i) =>
      i === index ? { ...r, condition: { ...r.condition, filter: { ...obj, start: iso } } } : r
    );
    this.hasPendingChanges = true;
  }

  updateBetweenEnd(index: number, val: string): void {
    const rule = this.pendingFilters[index];
    if (!rule) return;
    let iso = val;
    if (rule.type === 'date' && val && !val.includes('T')) {
      try { iso = new Date(val + 'T23:59:59.999Z').toISOString(); } catch {}
    }
    const current = rule.condition.filter;
    const obj = typeof current === 'object' && current !== null ? current : { start: '', end: '' };
    this.pendingFilters = this.pendingFilters.map((r, i) =>
      i === index ? { ...r, condition: { ...r.condition, filter: { ...obj, end: iso } } } : r
    );
    this.hasPendingChanges = true;
  }

  updateGlue(glue: string): void {
    this.pendingGlue = glue;
    this.hasPendingChanges = true;
  }

  // ─── Run ──────────────────────────────────────────────

  onRun(): void {
    this.run.emit({
      filters: this.pendingFilters,
      glue: this.pendingGlue,
      page: this.sheet.currentPage,
      pageSize: this.sheet.pageSize,
    });
    this.hasPendingChanges = false;
  }

  onPageChange(page: number): void {
    this.pageChange.emit(page);
  }

  onPageSizeChange(size: number): void {
    this.pageSizeChange.emit(size);
  }

  // ─── Helpers ──────────────────────────────────────────

  getFieldLabel(col: string): string {
    const f = this.allFields.find(x => x.fullId === col);
    return f ? f.label : col;
  }

  /** Two-char type indicator matching the edit-mode shelves panel: `Aa` for
   *  text/identifier/boolean, `#` for number, `D` for date. */
  typeIconFor(type: string | undefined): string {
    switch (type) {
      case 'number': return '#';
      case 'date':   return 'D';
      default:       return 'Aa';
    }
  }

  isBetween(rule: FilterRule): boolean {
    return rule.condition.type === 'between';
  }

  // Keeps the row (and an open date picker) alive while its rule object is replaced.
  trackByIndex(index: number): number {
    return index;
  }

  isNoValueOp(rule: FilterRule): boolean {
    return rule.condition.type === 'isEmpty' || rule.condition.type === 'isNotEmpty';
  }

  getFilterStringValue(rule: FilterRule): string {
    const f = rule.condition.filter;
    return typeof f === 'string' ? f : '';
  }

  getDateDisplayValue(isoVal: string): string {
    if (!isoVal) return '';
    if (/^\d{4}-\d{2}-\d{2}$/.test(isoVal)) return isoVal;
    try { return new Date(isoVal).toISOString().split('T')[0]; } catch { return isoVal; }
  }

  getBetweenStart(rule: FilterRule): string {
    const f = rule.condition.filter;
    if (typeof f === 'object' && f && (f as any).start) return rule.type === 'date' ? this.getDateDisplayValue((f as any).start) : (f as any).start;
    return '';
  }

  getBetweenEnd(rule: FilterRule): string {
    const f = rule.condition.filter;
    if (typeof f === 'object' && f && (f as any).end) return rule.type === 'date' ? this.getDateDisplayValue((f as any).end) : (f as any).end;
    return '';
  }

  // ─── Period (date range) ──────────────────────────────
  //
  // The reporting period is the one thing a report consumer routinely needs to
  // change without editing the report: same columns, different month. Date
  // values are therefore editable here while every other filter value stays a
  // static chip — the field being filtered is still locked either way.

  isDateRule(rule: FilterRule): boolean {
    return rule?.type === 'date';
  }

  /** Which shortcut the rule's current start/end correspond to, or `custom`. */
  presetForRule(rule: FilterRule): string {
    const start = this.getBetweenStart(rule);
    const end = this.getBetweenEnd(rule);
    if (!start || !end) return 'custom';
    const match = this.datePresets.find(p => {
      const range = this.rangeForPreset(p.value);
      return !!range && range.start === start && range.end === end;
    });
    return match ? match.value : 'custom';
  }

  applyDatePreset(index: number, preset: string): void {
    const range = this.rangeForPreset(preset);
    // `custom` means "whatever is in the two inputs" — nothing to compute.
    if (!range) return;
    this.updateBetweenStart(index, range.start);
    this.updateBetweenEnd(index, range.end);
  }

  /** `YYYY-MM-DD` in the user's own timezone. Building the key from the local
   *  parts rather than toISOString() keeps a date from sliding a day backwards
   *  for anyone east of UTC. */
  private toDateKey(d: Date): string {
    const month = `${d.getMonth() + 1}`.padStart(2, '0');
    const day = `${d.getDate()}`.padStart(2, '0');
    return `${d.getFullYear()}-${month}-${day}`;
  }

  /** Weeks start Sunday, matching the fixed reports' date-picker presets. */
  private rangeForPreset(preset: string): { start: string; end: string } | null {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const y = today.getFullYear();
    const m = today.getMonth();

    const shiftDays = (from: Date, days: number) => {
      const d = new Date(from);
      d.setDate(d.getDate() + days);
      return d;
    };
    const range = (start: Date, end: Date) => ({ start: this.toDateKey(start), end: this.toDateKey(end) });
    const startOfWeek = shiftDays(today, -today.getDay());

    switch (preset) {
      case 'today':
        return range(today, today);
      case 'yesterday': {
        const d = shiftDays(today, -1);
        return range(d, d);
      }
      case 'thisWeek':
        return range(startOfWeek, shiftDays(startOfWeek, 6));
      case 'lastWeek': {
        const start = shiftDays(startOfWeek, -7);
        return range(start, shiftDays(start, 6));
      }
      case 'thisMonth':
        // Day 0 of the next month is the last day of this one, leap years included.
        return range(new Date(y, m, 1), new Date(y, m + 1, 0));
      case 'lastMonth':
        return range(new Date(y, m - 1, 1), new Date(y, m, 0));
      case 'thisQuarter': {
        const qStart = Math.floor(m / 3) * 3;
        return range(new Date(y, qStart, 1), new Date(y, qStart + 3, 0));
      }
      case 'thisYear':
        return range(new Date(y, 0, 1), new Date(y, 11, 31));
      case 'lastYear':
        return range(new Date(y - 1, 0, 1), new Date(y - 1, 11, 31));
      default:
        return null;
    }
  }
}
