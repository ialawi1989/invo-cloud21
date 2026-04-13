import { Component, OnInit, OnDestroy, Inject, inject } from '@angular/core';
import { CommonModule, DOCUMENT } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { CdkDragDrop, DragDropModule, moveItemInArray, transferArrayItem } from '@angular/cdk/drag-drop';
import { TranslateModule } from '@ngx-translate/core';
import { DashboardWidgets, DashboardRow } from '../../../employees/models/employee/employee';
import { DashboardService } from '../../services/dashboard.service';

@Component({
  selector: 'app-dashboard-quick-customize',
  standalone: true,
  templateUrl: './dashboard-quick-customize.component.html',
  styleUrls: ['./dashboard-quick-customize.component.scss'],
  imports: [CommonModule, FormsModule, DragDropModule, TranslateModule],
})
export class DashboardQuickCustomizeComponent implements OnInit, OnDestroy {
  private dashboardService = inject(DashboardService);
  public activeModal = inject(NgbActiveModal);

  allWidgets: DashboardWidgets[] = [];
  rows: DashboardRow[] = [];
  searchQuery: string = '';
  private styleElement: HTMLStyleElement | null = null;

  colSpanOptions = [
    { value: 3, label: '1/4', desc: '25%' },
    { value: 4, label: '1/3', desc: '33%' },
    { value: 6, label: '1/2', desc: '50%' },
    { value: 8, label: '2/3', desc: '66%' },
    { value: 9, label: '3/4', desc: '75%' },
    { value: 12, label: 'Full', desc: '100%' },
  ];

  constructor(@Inject(DOCUMENT) private document: Document) {}

  ngOnInit() {
    const style = this.document.createElement('style');
    style.textContent = `.cdk-drag-preview { z-index: 99999 !important; background: #fff; border-radius: 8px; box-shadow: 0 8px 32px rgba(0,0,0,.25); }`;
    this.document.head.appendChild(style);
    this.styleElement = style;
  }

  ngOnDestroy() {
    if (this.styleElement?.parentNode) this.styleElement.parentNode.removeChild(this.styleElement);
  }

  loadData(existingRows?: DashboardRow[]) {
    this.allWidgets = [];
    this.dashboardService.dashboardSelectedWidgets.forEach(comp => {
      const w = new DashboardWidgets(); w.ParseJson(comp); this.allWidgets.push(w);
    });
    if (existingRows?.length) {
      this.rows = existingRows.map(r => { const row = new DashboardRow(); row.ParseJson(r); return row; });
    } else { this.createDefaultRows(); }
  }

  private createDefaultRows() {
    this.rows = [];
    const added = this.allWidgets.filter(w => w.isAdded);
    if (!added.length) { this.rows.push(new DashboardRow()); return; }
    added.forEach((widget, i) => {
      const row = new DashboardRow(); row.order = i;
      const w = new DashboardWidgets(); w.ParseJson(widget); w.colSpan = 12; w.rowId = row.id; w.order = 0;
      row.widgets.push(w); this.rows.push(row);
    });
  }

  getAvailableWidgetsCount() { return this.allWidgets.filter(w => !w.isAdded).length; }

  getFilteredAvailableWidgets() {
    let widgets = this.allWidgets.filter(w => !w.isAdded);
    if (this.searchQuery.trim()) { const q = this.searchQuery.toLowerCase(); widgets = widgets.filter(w => w.title.toLowerCase().includes(q) || w.slug.toLowerCase().includes(q)); }
    return widgets;
  }

  addWidget(widget: DashboardWidgets) {
    widget.isAdded = true;
    let target = this.rows.find(r => r.getRemainingCols() >= 6);
    if (!target) { target = new DashboardRow(); target.order = this.rows.length; this.rows.push(target); }
    const w = new DashboardWidgets(); w.ParseJson(widget); w.colSpan = Math.min(6, target.getRemainingCols()); w.rowId = target.id; w.order = target.widgets.length;
    target.widgets.push(w);
  }

  removeWidget(widget: DashboardWidgets, row: DashboardRow, index: number) {
    row.widgets.splice(index, 1);
    const orig = this.allWidgets.find(w => w.slug === widget.slug); if (orig) orig.isAdded = false;
    if (!row.widgets.length && this.rows.length > 1) this.rows.splice(this.rows.indexOf(row), 1);
  }

  setWidgetColSpan(widget: DashboardWidgets, colSpan: number) { widget.colSpan = colSpan; }
  addRow() { const r = new DashboardRow(); r.order = this.rows.length; this.rows.push(r); }
  removeRow(index: number) { const row = this.rows[index]; row.widgets.forEach(w => { const o = this.allWidgets.find(x => x.slug === w.slug); if (o) o.isAdded = false; }); this.rows.splice(index, 1); if (!this.rows.length) this.rows.push(new DashboardRow()); }
  getConnectedRowIds(id: string) { return this.rows.filter(r => r.id !== id).map(r => r.id); }
  dropRow(e: CdkDragDrop<DashboardRow[]>) { moveItemInArray(this.rows, e.previousIndex, e.currentIndex); this.rows.forEach((r, i) => r.order = i); }
  dropWidget(e: CdkDragDrop<DashboardWidgets[]>) { if (e.previousContainer === e.container) moveItemInArray(e.container.data, e.previousIndex, e.currentIndex); else transferArrayItem(e.previousContainer.data, e.container.data, e.previousIndex, e.currentIndex); this.rows.forEach(r => r.widgets.forEach((w, i) => { w.order = i; w.rowId = r.id; })); }
  cancel() { this.activeModal.dismiss(); }

  resetToDefault() {
    this.rows = []; this.allWidgets.forEach(w => w.isAdded = false);
    this.dashboardService.dashboardSelectedWidgets.filter(w => w.isAdded).forEach(ow => { const w = this.allWidgets.find(x => x.slug === ow.slug); if (w) w.isAdded = true; });
    this.allWidgets.filter(w => w.isAdded).forEach((widget, i) => { const row = new DashboardRow(); row.order = i; const w = new DashboardWidgets(); w.ParseJson(widget); w.colSpan = 12; w.rowId = row.id; w.order = 0; row.widgets.push(w); this.rows.push(row); });
    if (!this.rows.length) this.rows.push(new DashboardRow());
  }

  save() {
    let idx = 0;
    const dashBoardOptions: any[] = [];
    this.rows.forEach((row, ri) => { row.order = ri; row.widgets.forEach((w, wi) => { w.order = wi; w.rowId = row.id; w.index = idx++; dashBoardOptions.push({ slug: w.slug, title: w.title, isAdded: true, index: w.index, defaultHeight: w.defaultHeight, rowId: w.rowId, colSpan: w.colSpan, order: w.order }); }); });
    this.activeModal.close({ dashBoardOptions, rows: this.rows.map(r => { const nr = new DashboardRow(); nr.id = r.id; nr.order = r.order; nr.widgets = r.widgets.map(w => { const nw = new DashboardWidgets(); nw.ParseJson(w); return nw; }); return nr; }), widgets: this.allWidgets });
  }
}
