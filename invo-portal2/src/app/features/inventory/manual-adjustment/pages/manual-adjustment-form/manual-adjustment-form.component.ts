import { Component, OnInit, inject } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';

import { LanguageService } from '@core/i18n/language.service';
import type { CanLeaveComponent } from '@core/guards/unsaved-changes.guard';
import { DatePickerComponent } from '@shared/components/datepicker/date-picker.component';
import { SearchDropdownComponent } from '@shared/components/dropdown';
import { SegmentedToggleComponent, SegmentedToggleOption } from '@shared/components/segmented-toggle/segmented-toggle.component';
import type { BreadcrumbItem } from '@shared/components/breadcrumbs/breadcrumbs.types';
import { ToastService } from '@shared/components/toast/toast.service';
import { ModalService } from '@shared/modal/modal.service';

import '../../manual-adjustment-i18n';
import { DocFormShellComponent } from '../../../../account/components/doc-form-shell/doc-form-shell.component';
import { DocImportLinesModalComponent, ImportLinesResult } from '../../../../account/components/doc-import-lines-modal/doc-import-lines-modal.component';
import { SalesLookupsService } from '../../../../account/services/sales-lookups.service';
import { AdjustmentLine, AdjustmentProduct, AdjustmentType, ManualAdjustment, isUnitCost } from '../../models/manual-adjustment.model';
import { ManualAdjustmentService } from '../../services/manual-adjustment.service';
import {
  AdjustmentPickerData, AdjustmentPickerResult, ManualAdjustmentPickerComponent,
} from '../../components/manual-adjustment-picker/manual-adjustment-picker.component';

interface Choice { id: string; name: string; }

const r3 = (n: number) => Math.round(n * 1000) / 1000;

/**
 * Manual adjustments -> create / edit (`/manual-adjustment/new`, `/manual-adjustment/:id`). Legacy
 * `ManualAdjustmentFormComponent`. An adjustment is either "On hand" (type the new quantity on hand OR the quantity
 * adjusted - the two follow each other) or "Unit cost" (type the new unit cost, which re-values the stock). The type
 * is fixed once the first product is added; the branch is fixed once the adjustment was saved. A saved unit-cost
 * adjustment can't be edited (the backend refuses it).
 */
@Component({
  selector: 'app-manual-adjustment-form',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslateModule, DocFormShellComponent, SearchDropdownComponent, DatePickerComponent, SegmentedToggleComponent],
  templateUrl: './manual-adjustment-form.component.html',
  styleUrl: './manual-adjustment-form.component.scss',
})
export class ManualAdjustmentFormComponent implements OnInit, CanLeaveComponent {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private location = inject(Location);
  private lang = inject(LanguageService);
  private toast = inject(ToastService);
  private modal = inject(ModalService);
  private service = inject(ManualAdjustmentService);
  private lookups = inject(SalesLookupsService);

  a: ManualAdjustment | null = null;
  isNew = true;
  branches: Choice[] = [];
  breadcrumbs: BreadcrumbItem[] = [];
  submitting = false;
  showErrors = false;
  filterTerm = '';
  private dirty = false;
  private saved = false;

  typeOptions: SegmentedToggleOption<AdjustmentType>[] = [];

  async ngOnInit(): Promise<void> {
    // The shell and import dialog use the shared document strings (DOC_FORM, DOC_IMPORT, ...).
    await Promise.all([this.lang.loadFeature('inventory/manual-adjustment'), this.lang.loadFeature('account/components/doc-lines-table')]);
    this.typeOptions = [
      { value: 'onHand adjustment', label: 'MANUAL_ADJUSTMENT.TYPE.onHand adjustment' },
      { value: 'unitCost adjustment', label: 'MANUAL_ADJUSTMENT.TYPE.unitCost adjustment' },
    ];
    const id = this.route.snapshot.paramMap.get('id');
    this.isNew = !id;

    this.branches = (await this.lookups.getBranches()).map((b: any) => ({ id: b.id, name: b.name }));

    if (id) {
      const loaded = await this.service.getById(id);
      if (!loaded) {
        this.toast.error('COMMON.OPS', this.lang.instant('MANUAL_ADJUSTMENT.NOT_FOUND'));
        void this.router.navigate(['/manual-adjustment']);
        return;
      }
      this.a = loaded;
    } else {
      this.a = {
        id: '', adjustmentType: 'onHand adjustment', inventoryMovmentDate: new Date().toISOString(), branchId: this.branches[0]?.id ?? '',
        branchName: '', employeeName: '', cost: 0, lines: [],
      };
    }
    this.buildBreadcrumbs();
    this.dirty = false;
  }

  hasUnsavedChanges(): boolean { return this.dirty && !this.saved; }
  mark(): void { this.dirty = true; }

  private buildBreadcrumbs(): void {
    const l = (k: string) => this.lang.instant('MANUAL_ADJUSTMENT.' + k);
    this.breadcrumbs = [
      { label: l('DASHBOARD'), routerLink: '/dashboard' },
      { label: l('TITLE'), routerLink: '/manual-adjustment' },
      { label: l(this.isNew ? 'FORM_NEW' : 'FORM_EDIT') },
    ];
  }

  get title(): string { return this.lang.instant('MANUAL_ADJUSTMENT.' + (this.isNew ? 'FORM_NEW' : 'FORM_EDIT')); }

  // ── state helpers ──────────────────────────────────────────────────
  get isCost(): boolean { return isUnitCost(this.a?.adjustmentType); }
  /** A saved unit-cost adjustment can't be edited (the backend refuses it). */
  get locked(): boolean { return !this.isNew && this.isCost; }
  /** Type is fixed once the adjustment was saved or has products. */
  get typeLocked(): boolean { return this.locked || !this.isNew || this.liveLines.length > 0; }
  get liveLines(): AdjustmentLine[] { return (this.a?.lines ?? []).filter(l => !l.isDeleted); }
  get shownLines(): AdjustmentLine[] {
    const q = this.filterTerm.trim().toLowerCase();
    return q ? this.liveLines.filter(l => l.productName.toLowerCase().includes(q) || (l.barcode ?? '').toLowerCase().includes(q)) : this.liveLines;
  }

  choiceOf = (list: Choice[], id: string | null | undefined) => list.find(c => c.id === id) ?? null;
  label = (c: Choice) => c?.name ?? '';
  byId = (x: Choice, y: Choice) => x?.id === y?.id;

  get date(): Date { return this.a?.inventoryMovmentDate ? new Date(this.a.inventoryMovmentDate) : new Date(); }
  onDate(v: any): void { if (v instanceof Date) { this.a!.inventoryMovmentDate = v.toISOString(); this.mark(); } }

  onType(v: AdjustmentType): void { if (!this.typeLocked) { this.a!.adjustmentType = v; this.mark(); } }

  onBranch(c: Choice | null): void {
    const a = this.a!;
    if (!c || c.id === a.branchId) return;
    a.branchId = c.id;
    // On-hand and cost are per branch: products picked for the previous branch no longer apply.
    a.lines = a.lines.filter(l => !!l.id);
    this.mark();
  }

  // ── lines ──────────────────────────────────────────────────────────
  private lineOf(p: AdjustmentProduct): AdjustmentLine {
    return {
      id: '', productId: p.id, productName: p.name, UOM: p.UOM, barcode: p.barcode, qty: 0, newQty: p.onHand, currentOnHand: p.onHand,
      currentCost: p.unitCost, cost: p.unitCost, isNew: true,
    };
  }

  async addProducts(): Promise<void> {
    const a = this.a!;
    if (!a.branchId || this.locked) return;
    const live = this.liveLines;
    const res = await this.modal.open<ManualAdjustmentPickerComponent, AdjustmentPickerData, AdjustmentPickerResult | null>(ManualAdjustmentPickerComponent, {
      size: 'md',
      data: { branchId: a.branchId, date: a.inventoryMovmentDate, selectedIds: live.map(l => l.productId) },
    }).afterClosed();
    if (!res) return;
    const keep = new Set(res.ids);
    // Unticked products leave the adjustment, except lines that were already saved (legacy never deletes those here).
    a.lines = a.lines.filter(l => keep.has(l.productId) || !!l.id);
    const have = new Set(a.lines.map(l => l.productId));
    res.products.filter(p => keep.has(p.id) && !have.has(p.id)).forEach(p => a.lines.push(this.lineOf(p)));
    this.mark();
  }

  async importLines(): Promise<void> {
    const a = this.a!;
    const res = await this.modal.open<DocImportLinesModalComponent, void, ImportLinesResult | null>(DocImportLinesModalComponent, { size: 'lg' }).afterClosed();
    if (!res?.lines?.length) return;
    const rows = res.lines.filter(l => l.barcode);
    const found = await this.service.getProductsByBarcodes(rows.map(r => r.barcode), a.branchId);
    const byCode = new Map(found.map(p => [String(p.barcode), p]));
    const missing: string[] = [];
    for (const row of rows) {
      const p = byCode.get(String(row.barcode));
      if (!p) { missing.push(row.barcode); continue; }
      const line = this.lineOf(p);
      // Quantity = the NEW quantity on hand and Price = the NEW unit cost, as in the legacy import.
      line.newQty = Number(row.qty) || 0;
      line.qty = r3(line.newQty - line.currentOnHand);
      line.cost = row.price != null ? Number(row.price) || 0 : line.currentCost;
      const i = a.lines.findIndex(l => l.productId === p.id && !l.isDeleted);
      if (i >= 0) a.lines[i] = { ...line, id: a.lines[i].id, isNew: a.lines[i].isNew };
      else a.lines.push(line);
    }
    if (missing.length) this.toast.error('COMMON.OPS', this.lang.instant('MANUAL_ADJUSTMENT.NOT_IMPORTED', { list: missing.join(', ') }));
    this.mark();
  }

  removeLine(l: AdjustmentLine): void {
    if (this.locked) return;
    const a = this.a!;
    if (l.id) l.isDeleted = true; else a.lines = a.lines.filter(x => x !== l);
    this.mark();
  }

  /** "New quantity on hand" and "Quantity adjusted" follow each other. */
  setNewQty(l: AdjustmentLine, v: any): void { l.newQty = Number(v) || 0; l.qty = r3(l.newQty - l.currentOnHand); this.mark(); }
  setQty(l: AdjustmentLine, v: any): void { l.qty = Number(v) || 0; l.newQty = r3(l.currentOnHand + l.qty); this.mark(); }
  setCost(l: AdjustmentLine, v: any): void { l.cost = Number(v) || 0; this.mark(); }

  /** Estimated change in the stock value: qty x current cost, or the cost difference over the units held. */
  get totalImpact(): number {
    return r3(this.liveLines.reduce((s, l) => s + (this.isCost ? (l.cost - l.currentCost) * l.currentOnHand : l.qty * l.currentCost), 0));
  }
  get totalQty(): number { return this.isCost ? 0 : r3(this.liveLines.reduce((s, l) => s + l.qty, 0)); }

  // ── validation + save ──────────────────────────────────────────────
  get missing(): string[] {
    const out: string[] = [];
    if (!this.a?.branchId) out.push('BRANCH');
    if (!this.liveLines.length) out.push('LINES');
    return out;
  }

  async save(): Promise<void> {
    const a = this.a!;
    this.showErrors = true;
    if (this.missing.length || this.locked) return;
    this.submitting = true;
    try {
      const res = await this.service.save(a);
      if (res?.success) {
        this.saved = true;
        this.toast.success('MANUAL_ADJUSTMENT.SAVED');
        void this.router.navigate(['/manual-adjustment']);
      } else {
        this.toast.error('COMMON.OPS', typeof res?.msg === 'string' ? res.msg : this.lang.instant('MANUAL_ADJUSTMENT.SAVE_FAILED'));
      }
    } catch (e: any) {
      this.toast.error('COMMON.OPS', e?.error?.msg ?? e?.message ?? this.lang.instant('MANUAL_ADJUSTMENT.SAVE_FAILED'));
    } finally {
      this.submitting = false;
    }
  }

  cancel(): void {
    if (window.history.length > 1) this.location.back(); else void this.router.navigate(['/manual-adjustment']);
  }
  view(): void { if (this.a?.id) void this.router.navigate(['/manual-adjustment/view', this.a.id]); }
}
