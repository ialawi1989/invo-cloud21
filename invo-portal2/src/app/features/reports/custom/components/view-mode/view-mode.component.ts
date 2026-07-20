import { Component, Input, Output, EventEmitter, OnInit } from '@angular/core';
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

@Component({
  selector: 'app-view-mode',
  standalone: true,
  imports: [CommonModule, FormsModule, NgSelectModule, ChartPreviewComponent, PaginationComponent],
  templateUrl: './view-mode.component.html',
  styleUrls: ['./view-mode.component.scss'],
})
export class ViewModeComponent implements OnInit {
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
  @Input() totalRows = 0;
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

  ngOnInit(): void {
    this.pendingFilters = this.sheet.filterRules.map(r => ({ ...r, condition: { ...r.condition } }));
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
    if (val && !val.includes('T')) {
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
    if (val && !val.includes('T')) {
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
    if (typeof f === 'object' && f && (f as any).start) return this.getDateDisplayValue((f as any).start);
    return '';
  }

  getBetweenEnd(rule: FilterRule): string {
    const f = rule.condition.filter;
    if (typeof f === 'object' && f && (f as any).end) return this.getDateDisplayValue((f as any).end);
    return '';
  }
}
