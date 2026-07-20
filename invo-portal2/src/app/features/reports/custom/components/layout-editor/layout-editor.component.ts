import { Component, EventEmitter, Inject, Input, OnDestroy, OnInit, Output } from '@angular/core';
import { CommonModule, DOCUMENT } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { CdkDragDrop, DragDropModule, moveItemInArray, transferArrayItem } from '@angular/cdk/drag-drop';
import { DashboardRow, DashboardWidgets } from '../../models/dashboard-layout.model';

export interface ColSpanOption { value: number; label: string; desc?: string; }

const DEFAULT_COLSPAN_OPTIONS: ColSpanOption[] = [
  { value: 3, label: '1/4', desc: '25%' },
  { value: 4, label: '1/3', desc: '33%' },
  { value: 6, label: '1/2', desc: '50%' },
  { value: 8, label: '2/3', desc: '66%' },
  { value: 9, label: '3/4', desc: '75%' },
  { value: 12, label: 'Full', desc: '100%' },
];

/**
 * Shared, presentational 12-column layout editor: rows of cards with drag-drop
 * reorder, per-card width (colSpan) presets, and remove/settings actions.
 *
 * Reused by BOTH the main dashboard's Customize modal and the custom-report
 * (in-report) dashboard. It owns ONLY the layout (DashboardRow[] of
 * DashboardWidgets); the available-items panel, persistence and any settings
 * dialog live in the host component, which reacts to the outputs below.
 */
@Component({
  selector: 'app-layout-editor',
  standalone: true,
  imports: [CommonModule, TranslateModule, DragDropModule],
  templateUrl: './layout-editor.component.html',
  styleUrls: ['./layout-editor.component.scss'],
})
export class LayoutEditorComponent implements OnInit, OnDestroy {
  @Input() rows: DashboardRow[] = [];
  @Input() colSpanOptions: ColSpanOption[] = DEFAULT_COLSPAN_OPTIONS;
  /** Show a gear button on custom-report cards (emits `openSettings`). */
  @Input() showSettings = true;

  /** Emitted after any structural change (reorder / resize / add / remove). */
  @Output() rowsChange = new EventEmitter<DashboardRow[]>();
  /** A widget was removed from the layout (host re-enables it as available). */
  @Output() widgetRemoved = new EventEmitter<DashboardWidgets>();
  /** Gear clicked on a custom-report card. */
  @Output() openSettings = new EventEmitter<DashboardWidgets>();

  private styleElement: HTMLStyleElement | null = null;

  constructor(@Inject(DOCUMENT) private document: Document) {}

  ngOnInit(): void {
    this.addDragPreviewStyles();
  }

  ngOnDestroy(): void {
    if (this.styleElement?.parentNode) {
      this.styleElement.parentNode.removeChild(this.styleElement);
    }
  }

  // ─── Rows ────────────────────────────────────────────
  addRow(): void {
    const row = new DashboardRow();
    row.order = this.rows.length;
    this.rows.push(row);
    this.rowsChange.emit(this.rows);
  }

  removeRow(index: number): void {
    const row = this.rows[index];
    row.widgets.forEach(w => this.widgetRemoved.emit(w));
    this.rows.splice(index, 1);
    if (this.rows.length === 0) this.rows.push(new DashboardRow());
    this.rowsChange.emit(this.rows);
  }

  // ─── Widgets ─────────────────────────────────────────
  removeWidget(widget: DashboardWidgets, row: DashboardRow, index: number): void {
    row.widgets.splice(index, 1);
    this.widgetRemoved.emit(widget);
    if (row.widgets.length === 0 && this.rows.length > 1) {
      const ri = this.rows.indexOf(row);
      if (ri > -1) this.rows.splice(ri, 1);
    }
    this.rowsChange.emit(this.rows);
  }

  setWidgetColSpan(widget: DashboardWidgets, colSpan: number): void {
    widget.colSpan = colSpan;
    this.rowsChange.emit(this.rows);
  }

  // ─── Drag & drop ─────────────────────────────────────
  getConnectedRowIds(currentRowId: string): string[] {
    return this.rows.filter(r => r.id !== currentRowId).map(r => r.id);
  }

  dropRow(event: CdkDragDrop<DashboardRow[]>): void {
    moveItemInArray(this.rows, event.previousIndex, event.currentIndex);
    this.rows.forEach((r, i) => (r.order = i));
    this.rowsChange.emit(this.rows);
  }

  dropWidget(event: CdkDragDrop<DashboardWidgets[]>): void {
    if (event.previousContainer === event.container) {
      moveItemInArray(event.container.data, event.previousIndex, event.currentIndex);
    } else {
      transferArrayItem(event.previousContainer.data, event.container.data, event.previousIndex, event.currentIndex);
    }
    this.rows.forEach(row => row.widgets.forEach((w, i) => { w.order = i; w.rowId = row.id; }));
    this.rowsChange.emit(this.rows);
  }

  /** Smooth-scroll the editor to a row (after it has rendered). */
  scrollToRow(rowId: string): void {
    setTimeout(() => {
      const el = this.document.querySelector(`.layout-row[data-row-id="${rowId}"]`);
      if (el) (el as HTMLElement).scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 50);
  }

  // Global style so the CDK drag preview floats above any modal overlay.
  private addDragPreviewStyles(): void {
    if (this.document.getElementById('layout-editor-drag-styles')) return;
    this.styleElement = this.document.createElement('style');
    this.styleElement.id = 'layout-editor-drag-styles';
    this.styleElement.textContent = `
      .cdk-drag-preview { z-index: 99999 !important; box-sizing: border-box; background:#fff; border-radius:8px; box-shadow:0 8px 32px rgba(0,0,0,0.25); }
      .cdk-overlay-container { z-index: 99999 !important; }
      .cdk-drag-preview .widget-card { background:#fff; border:1px solid #00aab3; border-radius:8px; padding:10px 12px; display:flex; align-items:center; gap:10px; }
      .cdk-drag-preview .row-header { background:#fff; padding:12px 16px; border-bottom:1px solid #e5e7eb; }
      .cdk-drag-preview .row-widgets { padding:16px; background:#f9fafb; }
    `;
    this.document.head.appendChild(this.styleElement);
  }
}
