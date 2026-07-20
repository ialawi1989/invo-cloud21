import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NgSelectModule } from '@ng-select/ng-select';
import {
  DashboardConfig,
  DashboardSheet,
  SheetConfig,
  FilterRule,
  FILTER_OPERATORS,
  FlatField,
} from '../../shared/models/custom-report.model';
import { ChartPreviewComponent } from '../chart-preview/chart-preview.component';

@Component({
  selector: 'app-dashboard-canvas',
  standalone: true,
  imports: [CommonModule, FormsModule, NgSelectModule, ChartPreviewComponent],
  templateUrl: './dashboard-canvas.component.html',
  styleUrls: ['./dashboard-canvas.component.scss'],
})
export class DashboardCanvasComponent {
  @Input() dashboard!: DashboardConfig;
  @Input() sheets: SheetConfig[] = [];
  @Input() sheetsData: Map<string, any[]> = new Map();
  @Input() sheetsLoading: Set<string> = new Set();
  @Input() allFields: FlatField[] = [];
  @Output() layoutChange = new EventEmitter<DashboardSheet[]>();
  @Output() globalFiltersChange = new EventEmitter<{ filters: FilterRule[]; glue: string }>();
  @Output() runAll = new EventEmitter<void>();

  filterOperators = FILTER_OPERATORS;

  /** Card width presets (out of a 12-column grid). */
  widthOptions: { label: string; value: number }[] = [
    { label: '⅓', value: 4 },
    { label: '½', value: 6 },
    { label: '⅔', value: 8 },
    { label: 'Full', value: 12 },
  ];

  getSheetConfig(sheetId: string): SheetConfig | undefined {
    return this.sheets.find(s => s.id === sheetId);
  }

  getSheetData(sheetId: string): any[] {
    return this.sheetsData.get(sheetId) || [];
  }

  isSheetLoading(sheetId: string): boolean {
    return this.sheetsLoading.has(sheetId);
  }

  // Cards flow left-to-right (grid auto-placement) in array order, each
  // spanning `width` columns of a 12-col grid. We no longer pin explicit
  // x/y coordinates — reordering the array is the layout. `height` still
  // spans extra rows when > 1.
  getGridStyle(ds: DashboardSheet): { [key: string]: string } {
    const style: { [key: string]: string } = {
      'grid-column': `span ${ds.width}`,
    };
    if (ds.height && ds.height > 1) {
      style['grid-row'] = `span ${ds.height}`;
    }
    return style;
  }

  /** Resize a card to one of the width presets. */
  setWidth(target: DashboardSheet, width: number): void {
    this.dashboard.sheets = this.dashboard.sheets.map(ds =>
      ds.sheetId === target.sheetId ? { ...ds, width } : ds
    );
    this.layoutChange.emit(this.dashboard.sheets);
  }

  /** Move a card earlier (-1) or later (+1) in the flow. */
  moveCard(index: number, dir: -1 | 1): void {
    const arr = [...this.dashboard.sheets];
    const j = index + dir;
    if (j < 0 || j >= arr.length) return;
    [arr[index], arr[j]] = [arr[j], arr[index]];
    this.dashboard.sheets = arr;
    this.layoutChange.emit(arr);
  }

  getDimKey(data: any[]): string | null {
    if (!data || data.length === 0) return null;
    const keys = Object.keys(data[0]);
    return keys.find(k => !/^(sum|count|avg|max|min)\./.test(k) && k !== 'value') || keys[0];
  }

  getMeasKeys(data: any[]): string[] {
    if (!data || data.length === 0) return [];
    const dimKey = this.getDimKey(data);
    return Object.keys(data[0]).filter(k => k !== dimKey);
  }

  // ─── Global Filters ──────────────────────────────────

  addGlobalFilter(): void {
    this.dashboard.globalFilters = [
      ...this.dashboard.globalFilters,
      { field: '', type: 'text', condition: { type: 'equal', filter: '' }, includes: [] },
    ];
  }

  removeGlobalFilter(index: number): void {
    this.dashboard.globalFilters = this.dashboard.globalFilters.filter((_, i) => i !== index);
    this.globalFiltersChange.emit({
      filters: this.dashboard.globalFilters,
      glue: this.dashboard.globalFilterGlue,
    });
  }

  updateGlobalFilterField(index: number, field: string): void {
    const f = this.allFields.find(x => x.fullId === field);
    this.dashboard.globalFilters = this.dashboard.globalFilters.map((r, i) =>
      i === index ? { ...r, field, type: f?.type || 'text', condition: { ...r.condition, filter: '' } } : r
    );
  }

  onRunAll(): void {
    this.globalFiltersChange.emit({
      filters: this.dashboard.globalFilters,
      glue: this.dashboard.globalFilterGlue,
    });
    this.runAll.emit();
  }

  getFieldLabel(col: string): string {
    const f = this.allFields.find(x => x.fullId === col);
    return f ? f.label : col;
  }
}
