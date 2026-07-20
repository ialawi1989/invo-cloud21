import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NgSelectModule } from '@ng-select/ng-select';
import {
  SheetConfig,
  FlatField,
  ReportColumn,
  FilterRule,
  ColumnFormat,
  FILTER_OPERATORS,
  operatorsForType,
} from '../../shared/models/custom-report.model';

@Component({
  selector: 'app-shelves-panel',
  standalone: true,
  imports: [CommonModule, FormsModule, NgSelectModule],
  templateUrl: './shelves-panel.component.html',
  styleUrls: ['./shelves-panel.component.scss'],
})
export class ShelvesPanelComponent {
  @Input() sheet!: SheetConfig;
  @Input() allFields: FlatField[] = [];
  @Input() fieldOptions: { [fieldId: string]: any[] } = {};
  @Output() sheetChange = new EventEmitter<SheetConfig>();
  @Output() loadOptions = new EventEmitter<string>();
  /** Dropping a field onto a shelf is delegated to the parent so it can resolve
   *  (auto-inject) any join the field's table needs before adding the column. */
  @Output() addField = new EventEmitter<{ field: FlatField; target: 'columns' | 'rows' | 'filters' | 'group' }>();

  filterOperators = FILTER_OPERATORS;
  /** Per-rule operator list filtered to the rule's column type. Hides
   *  'Contains' on numbers/dates and 'Greater/Less' on text. */
  operatorsForRule(rule: FilterRule): typeof FILTER_OPERATORS {
    return operatorsForType(rule?.type);
  }
  editingPill: string | null = null;
  dragOverTarget: string | null = null;

  formatsByType: { [key: string]: { value: string; label: string }[] } = {
    number: [
      { value: 'none', label: 'None' },
      { value: 'number', label: 'Number' },
      { value: 'currency', label: 'Currency' },
      { value: 'percent', label: 'Percent' },
      { value: 'custom', label: 'Custom' },
    ],
    date: [
      { value: 'none', label: 'None' },
      { value: 'date', label: 'Date' },
      { value: 'custom', label: 'Custom' },
    ],
    text: [
      { value: 'none', label: 'None' },
      { value: 'custom', label: 'Custom' },
    ],
  };

  currencies = ['USD', 'EUR', 'GBP', 'SAR', 'AED', 'KWD', 'BHD', 'QAR', 'OMR', 'JOD', 'EGP', 'INR', 'JPY', 'CNY'];
  dateFormats = ['yyyy-MM-dd', 'dd/MM/yyyy', 'MM/dd/yyyy', 'MMM dd, yyyy', 'dd MMM yyyy'];

  /** Cached format options for the currently editing pill */
  editingFormatTypes: { value: string; label: string }[] = [];

  // ─── Native drag-and-drop ─────────────────────────────

  onDragOver(event: DragEvent, target: string): void {
    event.preventDefault();
    event.dataTransfer!.dropEffect = 'copy';
    this.dragOverTarget = target;
  }

  onDragLeave(target: string): void {
    if (this.dragOverTarget === target) this.dragOverTarget = null;
  }

  onDropShelf(event: DragEvent, shelf: 'columns' | 'rows'): void {
    event.preventDefault();
    this.dragOverTarget = null;
    const field = this.parseDropData(event);
    // Delegate to the parent so it can auto-resolve the join the field needs.
    if (field) this.addField.emit({ field, target: shelf });
  }

  onDropFilter(event: DragEvent): void {
    event.preventDefault();
    this.dragOverTarget = null;
    const field = this.parseDropData(event);
    if (field) this.addField.emit({ field, target: 'filters' });
  }

  onDropGroup(event: DragEvent): void {
    event.preventDefault();
    this.dragOverTarget = null;
    const field = this.parseDropData(event);
    // Parent resolves joins + blocks formulas (see onAddToShelf 'group').
    if (field) this.addField.emit({ field, target: 'group' });
  }

  /** Clear the single group-by field, reverting to non-grouped mode. */
  clearGroupBy(): void {
    this.sheet.groupBy = undefined;
    this.emitChange();
  }

  private parseDropData(event: DragEvent): FlatField | null {
    try {
      const json = event.dataTransfer!.getData('application/json');
      return json ? JSON.parse(json) as FlatField : null;
    } catch { return null; }
  }

  // ─── Pill actions ─────────────────────────────────────

  removePill(shelf: 'columns' | 'rows', key: string): void {
    const arr = shelf === 'columns' ? this.sheet.columnsShelf : this.sheet.rowsShelf;
    const removed = arr.find(c => c.key === key);
    if (shelf === 'columns') {
      this.sheet.columnsShelf = this.sheet.columnsShelf.filter(c => c.key !== key);
    } else {
      this.sheet.rowsShelf = this.sheet.rowsShelf.filter(c => c.key !== key);
    }
    // Remove orphaned sort rules that reference the removed column
    if (removed && this.sheet.sortBy?.length) {
      const sortId = removed.datePart
        ? removed.datePart + '.' + removed.col
        : removed.agg
          ? removed.agg + '.' + removed.col
          : removed.col;
      this.sheet.sortBy = this.sheet.sortBy.filter(s => s.id !== sortId);
    }
    this.emitChange();
  }

  removeFilter(index: number): void {
    this.sheet.filterRules = this.sheet.filterRules.filter((_, i) => i !== index);
    this.emitChange();
  }

  popoverStyle: { [key: string]: string } = {};

  togglePillEdit(event: MouseEvent, key: string): void {
    if (this.editingPill === key) {
      this.editingPill = null;
      return;
    }
    this.editingPill = key;
    // Cache format options based on column type
    const col = this.sheet.columnsShelf.find(c => c.key === key)
             || this.sheet.rowsShelf.find(c => c.key === key);
    if (col) {
      const fieldType = this.getFieldType(col.col);
      // If it has an aggregation (sum, avg, etc.) treat as number regardless of source type
      const effectiveType = col.agg ? 'number' : fieldType;
      this.editingFormatTypes = this.formatsByType[effectiveType] || this.formatsByType['text'];
    }
    // Position the popover using fixed coordinates from the click target
    const el = (event.target as HTMLElement).closest('.shelf-pill') as HTMLElement;
    if (el) {
      const rect = el.getBoundingClientRect();
      this.popoverStyle = {
        position: 'fixed',
        top: rect.bottom + 4 + 'px',
        left: rect.left + 'px',
        zIndex: '1000',
      };
    }
  }

  getEditingColumn(): ReportColumn | null {
    if (!this.editingPill) return null;
    return this.sheet.columnsShelf.find(c => c.key === this.editingPill)
        || this.sheet.rowsShelf.find(c => c.key === this.editingPill)
        || null;
  }

  getEditingShelf(): 'columns' | 'rows' {
    if (this.sheet.columnsShelf.find(c => c.key === this.editingPill)) return 'columns';
    return 'rows';
  }

  updateFormat(shelf: 'columns' | 'rows', key: string, partial: Partial<ColumnFormat>): void {
    const update = (c: ReportColumn) => {
      if (c.key !== key) return c;
      const existing = c.format || { type: 'none' as const };
      return { ...c, format: { ...existing, ...partial } as ColumnFormat };
    };
    if (shelf === 'columns') {
      this.sheet.columnsShelf = this.sheet.columnsShelf.map(update);
    } else {
      this.sheet.rowsShelf = this.sheet.rowsShelf.map(update);
    }
    this.emitChange();
  }

  /** Update alias locally on every keystroke (no emit — avoids re-render killing focus) */
  updateAliasLocal(shelf: 'columns' | 'rows', key: string, alias: string): void {
    const arr = shelf === 'columns' ? this.sheet.columnsShelf : this.sheet.rowsShelf;
    const col = arr.find(c => c.key === key);
    if (col) col.alias = alias || undefined;
  }

  /** Emit on blur so parent gets the final value */
  commitAlias(): void {
    this.emitChange();
  }

  updateAgg(shelf: 'columns' | 'rows', key: string, agg: string): void {
    const update = (c: ReportColumn) => c.key === key ? { ...c, agg } : c;
    if (shelf === 'columns') {
      this.sheet.columnsShelf = this.sheet.columnsShelf.map(update);
    } else {
      this.sheet.rowsShelf = this.sheet.rowsShelf.map(update);
    }
    this.editingPill = null;
    this.emitChange();
  }

  updateDatePart(shelf: 'columns' | 'rows', key: string, datePart: string): void {
    const update = (c: ReportColumn) => c.key === key ? { ...c, datePart } : c;
    if (shelf === 'columns') {
      this.sheet.columnsShelf = this.sheet.columnsShelf.map(update);
    } else {
      this.sheet.rowsShelf = this.sheet.rowsShelf.map(update);
    }
    this.editingPill = null;
    this.emitChange();
  }

  // ─── Swap shelves (transpose) ─────────────────────────

  swapShelves(): void {
    const tmp = this.sheet.columnsShelf;
    this.sheet.columnsShelf = this.sheet.rowsShelf;
    this.sheet.rowsShelf = tmp;
    this.emitChange();
  }

  // ─── Filter updates ──────────────────────────────────

  updateFilterOp(index: number, op: string): void {
    let newFilter: any = '';
    if (op === 'between') newFilter = { start: '', end: '' };
    if (op === 'isEmpty' || op === 'isNotEmpty') newFilter = '__none__'; // no value needed
    this.sheet.filterRules = this.sheet.filterRules.map((r, i) =>
      i === index ? { ...r, condition: { type: op, filter: newFilter } } : r
    );
    this.emitChange();
  }

  isNoValueOp(rule: FilterRule): boolean {
    return rule.condition.type === 'isEmpty' || rule.condition.type === 'isNotEmpty';
  }

  updateFilterValue(index: number, val: string): void {
    const rule = this.sheet.filterRules[index];
    let finalVal: string = val;
    if (rule && rule.type === 'date' && val && !val.includes('T')) {
      try { finalVal = new Date(val + 'T00:00:00.000Z').toISOString(); } catch { finalVal = val; }
    }
    this.sheet.filterRules = this.sheet.filterRules.map((r, i) =>
      i === index ? { ...r, condition: { ...r.condition, filter: finalVal } } : r
    );
    this.emitChange();
  }

  updateBetweenStart(index: number, val: string): void {
    const rule = this.sheet.filterRules[index];
    if (!rule) return;
    let iso = val;
    if (val && !val.includes('T')) {
      try { iso = new Date(val + 'T00:00:00.000Z').toISOString(); } catch {}
    }
    const current = rule.condition.filter;
    const obj = typeof current === 'object' && current !== null ? current : { start: '', end: '' };
    this.sheet.filterRules = this.sheet.filterRules.map((r, i) =>
      i === index ? { ...r, condition: { ...r.condition, filter: { ...obj, start: iso } } } : r
    );
    this.emitChange();
  }

  updateBetweenEnd(index: number, val: string): void {
    const rule = this.sheet.filterRules[index];
    if (!rule) return;
    let iso = val;
    if (val && !val.includes('T')) {
      try { iso = new Date(val + 'T23:59:59.999Z').toISOString(); } catch {}
    }
    const current = rule.condition.filter;
    const obj = typeof current === 'object' && current !== null ? current : { start: '', end: '' };
    this.sheet.filterRules = this.sheet.filterRules.map((r, i) =>
      i === index ? { ...r, condition: { ...r.condition, filter: { ...obj, end: iso } } } : r
    );
    this.emitChange();
  }

  // ─── Helpers ──────────────────────────────────────────

  getFieldLabel(col: string): string {
    const f = this.allFields.find(x => x.fullId === col);
    return f ? f.label : col;
  }

  getFieldType(col: string): string {
    const f = this.allFields.find(x => x.fullId === col);
    return f?.type || 'text';
  }

  /** True when a shelf column references a predefined formula ("Table.@key").
   *  COUNT is not offered for these — the backend's count is always COUNT(*). */
  isFormulaCol(col: string): boolean {
    return (col.split('.').pop() || '').startsWith('@');
  }

  typeIcon(type: string): string {
    switch (type) {
      case 'number': return '#';
      case 'date':   return 'D';
      default:       return 'Aa';
    }
  }

  getColumnDisplay(c: ReportColumn): string {
    if (c.alias) return c.alias;
    const label = this.getFieldLabel(c.col);
    if (c.agg) return `${c.agg.toUpperCase()}(${label})`;
    if (c.datePart) return `${c.datePart}(${label})`;
    return label;
  }

  isBetween(rule: FilterRule): boolean {
    return rule.condition.type === 'between';
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

  emitFilterGlue(): void {
    this.emitChange();
  }

  private emitChange(): void {
    this.sheetChange.emit({ ...this.sheet });
  }
}
