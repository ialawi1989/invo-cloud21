import { Component, Input, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NgSelectModule } from '@ng-select/ng-select';
import { MODAL_DATA, MODAL_REF } from '@shared/modal/modal.tokens';
import type { ModalRef } from '@shared/modal/modal.service';
import { FlatField, ReportColumn } from '../../shared/models/custom-report.model';

/** Data passed to the column picker when opened via ModalService. */
export interface ColumnPickerData { allFields: FlatField[]; columns: ReportColumn[]; }

@Component({
  selector: 'app-column-picker',
  standalone: true,
  imports: [CommonModule, FormsModule, NgSelectModule],
  templateUrl: './column-picker.component.html',
  styleUrls: ['./column-picker.component.scss'],
})
export class ColumnPickerComponent implements OnInit {
  @Input() allFields: FlatField[] = [];
  @Input() columns: ReportColumn[] = [];

  // Internal working copy — changes only apply on "Done"
  workingColumns: ReportColumn[] = [];
  fieldSearch = '';            // search on the left (available) panel
  selectedSearch = '';         // search on the right (selected) panel

  // Multi-select: click toggles membership in each panel's selection set.
  selectedLeft = new Set<string>();   // by FlatField.fullId
  selectedRight = new Set<string>();  // by ReportColumn.key

  // invo-portal2 modal wiring (converted from ng-bootstrap's NgbActiveModal):
  // inputs arrive via MODAL_DATA and the result is returned through MODAL_REF.
  private modalRef = inject<ModalRef<ReportColumn[]>>(MODAL_REF);
  private modalData = inject<ColumnPickerData>(MODAL_DATA, { optional: true });

  ngOnInit(): void {
    if (this.modalData) {
      this.allFields = this.modalData.allFields ?? this.allFields;
      this.columns = this.modalData.columns ?? this.columns;
    }
    this.workingColumns = [...this.columns];
  }

  toggleLeft(fullId: string, event?: MouseEvent): void {
    // Plain click toggles. Shift+Click adds to / extends the selection,
    // Ctrl/Cmd+Click also toggles (kept the same for discoverability).
    if (this.selectedLeft.has(fullId)) this.selectedLeft.delete(fullId);
    else this.selectedLeft.add(fullId);
  }

  toggleRight(key: string): void {
    if (this.selectedRight.has(key)) this.selectedRight.delete(key);
    else this.selectedRight.add(key);
  }

  /** Select / clear every currently visible row on the left panel. */
  toggleSelectAllVisible(): void {
    const visibleIds = this.availableFields.map(f => f.fullId);
    const allSelected = visibleIds.length > 0 && visibleIds.every(id => this.selectedLeft.has(id));
    if (allSelected) visibleIds.forEach(id => this.selectedLeft.delete(id));
    else visibleIds.forEach(id => this.selectedLeft.add(id));
  }

  get allVisibleSelected(): boolean {
    const v = this.availableFields;
    return v.length > 0 && v.every(f => this.selectedLeft.has(f.fullId));
  }

  /** Right-panel columns filtered by the selected-search box. */
  get filteredSelected(): ReportColumn[] {
    const q = this.selectedSearch.trim().toLowerCase();
    if (!q) return this.workingColumns;
    return this.workingColumns.filter(c =>
      this.getFieldLabel(c.col).toLowerCase().includes(q) ||
      this.getFieldTable(c.col).toLowerCase().includes(q)
    );
  }

  /** Select / clear every currently visible row on the right panel. */
  toggleSelectAllVisibleRight(): void {
    const keys = this.filteredSelected.map(c => c.key);
    const allSelected = keys.length > 0 && keys.every(k => this.selectedRight.has(k));
    if (allSelected) keys.forEach(k => this.selectedRight.delete(k));
    else keys.forEach(k => this.selectedRight.add(k));
  }

  get allVisibleSelectedRight(): boolean {
    const v = this.filteredSelected;
    return v.length > 0 && v.every(c => this.selectedRight.has(c.key));
  }

  get selectedIds(): string[] {
    return this.workingColumns.map((c) => c.col);
  }

  get availableFields(): FlatField[] {
    return this.allFields.filter(
      (f) =>
        !this.selectedIds.includes(f.fullId) &&
        (!this.fieldSearch || f.label.toLowerCase().includes(this.fieldSearch.toLowerCase()))
    );
  }

  get groupedAvailable(): { [table: string]: FlatField[] } {
    const grouped: { [key: string]: FlatField[] } = {};
    this.availableFields.forEach((f) => {
      if (!grouped[f.table]) grouped[f.table] = [];
      grouped[f.table].push(f);
    });
    return grouped;
  }

  get groupedKeys(): string[] {
    return Object.keys(this.groupedAvailable);
  }

  addField(fullId: string): void {
    const f = this.allFields.find((x) => x.fullId === fullId);
    if (!f) return;
    this.workingColumns = [
      ...this.workingColumns,
      { col: f.fullId, agg: '', datePart: '', key: Date.now() + '-' + f.fullId },
    ];
    this.selectedLeft.delete(fullId);
  }

  removeField(key: string): void {
    this.workingColumns = this.workingColumns.filter((c) => c.key !== key);
    this.selectedRight.delete(key);
  }

  /** Move every currently-selected available field to the right panel. */
  addHighlighted(): void {
    const ids = [...this.selectedLeft];
    if (ids.length === 0) return;
    ids.forEach(id => this.addField(id));
    this.selectedLeft.clear();
  }

  /** Remove every currently-selected column from the right panel. */
  removeHighlighted(): void {
    const keys = [...this.selectedRight];
    if (keys.length === 0) return;
    keys.forEach(k => this.removeField(k));
    this.selectedRight.clear();
  }

  getFieldLabel(col: string): string {
    const f = this.allFields.find((x) => x.fullId === col);
    return f ? f.label : col.split('.')[1] || col;
  }

  getFieldTable(col: string): string {
    return col.split('.')[0];
  }

  done(): void {
    this.modalRef.close(this.workingColumns);
  }

  cancel(): void {
    this.modalRef.close(undefined);
  }

  isNumericField(col: string): boolean {
    const f = this.allFields.find((x) => x.fullId === col);
    return f?.type === 'number';
  }

  isDateField(col: string): boolean {
    const f = this.allFields.find((x) => x.fullId === col);
    return f?.type === 'date';
  }

  setAgg(key: string, agg: string): void {
    this.workingColumns = this.workingColumns.map((c) =>
      c.key === key ? { ...c, agg } : c
    );
  }

  setDatePart(key: string, datePart: string): void {
    this.workingColumns = this.workingColumns.map((c) =>
      c.key === key ? { ...c, datePart } : c
    );
  }
}
