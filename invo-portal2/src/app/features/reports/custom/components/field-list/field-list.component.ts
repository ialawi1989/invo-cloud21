import { Component, Input, Output, EventEmitter, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NgSelectModule } from '@ng-select/ng-select';
import { FlatField, DataSourceTable } from '../../shared/models/custom-report.model';

interface FieldGroup {
  tableId: string;
  fields: FlatField[];
}

type FieldTypeFilter = 'all' | 'text' | 'number' | 'date';

@Component({
  selector: 'app-field-list',
  standalone: true,
  imports: [CommonModule, FormsModule, NgSelectModule],
  templateUrl: './field-list.component.html',
  styleUrls: ['./field-list.component.scss'],
})
export class FieldListComponent implements OnChanges {
  @Input() fields: FlatField[] = [];
  @Input() joinedTableIds: string[] = [];

  // ─── New optional inputs (UI only — for data source dropdown) ──
  @Input() dataSources: DataSourceTable[] = [];
  @Input() primaryTable = '';

  @Output() fieldDoubleClick = new EventEmitter<FlatField>();
  @Output() addToShelf = new EventEmitter<{ field: FlatField; target: 'columns' | 'rows' | 'filters' | 'group' }>();
  @Output() primaryTableChange = new EventEmitter<string>();
  @Output() createCalculated = new EventEmitter<void>();

  fieldSearch = '';
  typeFilter: FieldTypeFilter = 'all';
  fieldGroups: FieldGroup[] = [];
  /** Predefined formulas (filter-only). Surfaced in a dedicated section so they
   *  read as distinct from real columns. */
  formulaFields: FlatField[] = [];
  collapsedGroups = new Set<string>();
  calculatedOpen = true;
  formulasOpen = true;

  toggleGroup(tableId: string): void {
    if (this.collapsedGroups.has(tableId)) this.collapsedGroups.delete(tableId);
    else this.collapsedGroups.add(tableId);
  }

  isGroupOpen(tableId: string): boolean {
    return !this.collapsedGroups.has(tableId);
  }

  toggleCalculated(): void {
    this.calculatedOpen = !this.calculatedOpen;
  }

  toggleFormulas(): void {
    this.formulasOpen = !this.formulasOpen;
  }

  onCreateCalc(event: Event): void {
    event.stopPropagation();
    this.createCalculated.emit();
  }

  setTypeFilter(t: FieldTypeFilter): void {
    this.typeFilter = t;
    this.buildFieldGroups();
  }

  onPrimaryTableChange(id: string): void {
    this.primaryTableChange.emit(id);
  }

  ngOnChanges(_changes: SimpleChanges): void {
    this.buildFieldGroups();
  }

  onSearchChange(): void {
    this.buildFieldGroups();
  }

  private buildFieldGroups(): void {
    const search = this.fieldSearch.toLowerCase();
    this.fieldGroups = this.joinedTableIds.map(tableId => {
      // Formulas are surfaced in their own section, not inside table groups.
      let tableFields = this.fields.filter(f => f.table === tableId && !f.isFormula);
      if (this.typeFilter !== 'all') {
        tableFields = tableFields.filter(f => f.type === this.typeFilter);
      }
      if (search) {
        tableFields = tableFields.filter(f => f.label.toLowerCase().includes(search));
      }
      return { tableId, fields: tableFields };
    }).filter(g => g.fields.length > 0);

    // Predefined formulas (filter-only) — respect search + type filter chips.
    let formulas = this.fields.filter(f => f.isFormula);
    if (this.typeFilter !== 'all') {
      formulas = formulas.filter(f => f.type === this.typeFilter);
    }
    if (search) {
      formulas = formulas.filter(f => f.label.toLowerCase().includes(search));
    }
    this.formulaFields = formulas;
  }

  onDragStart(event: DragEvent, field: FlatField): void {
    event.dataTransfer!.setData('application/json', JSON.stringify(field));
    event.dataTransfer!.effectAllowed = 'copy';
  }

  onDoubleClick(field: FlatField): void {
    this.fieldDoubleClick.emit(field);
  }

  onAddTo(event: Event, field: FlatField, target: 'columns' | 'rows' | 'filters' | 'group'): void {
    event.stopPropagation();
    this.addToShelf.emit({ field, target });
  }

  trackGroup(_index: number, group: FieldGroup): string { return group.tableId; }
  trackField(_index: number, field: FlatField): string { return field.fullId; }

  getTypeIcon(type: string): string {
    switch (type) {
      case 'number': return '#';
      case 'date':   return 'D';
      default:       return 'Aa';
    }
  }

  /** A field is foreign-key-ish if its id ends in 'Id' */
  isFK(field: FlatField): boolean {
    return /Id$/.test(field.id);
  }

  /** Resolve a table id to its label (falls back to id) */
  tableLabel(id: string): string {
    const t = this.dataSources.find(x => x.id === id);
    return t ? t.label : id;
  }
}
