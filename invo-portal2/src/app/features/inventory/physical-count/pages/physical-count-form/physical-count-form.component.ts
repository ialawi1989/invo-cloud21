import { Component, OnInit, inject } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';

import { LanguageService } from '@core/i18n/language.service';
import { PrivilegeService } from '@core/auth/privileges/privilege.service';
import type { CanLeaveComponent } from '@core/guards/unsaved-changes.guard';
import { SearchDropdownComponent } from '@shared/components/dropdown';
import type { DropdownLoadFn } from '@shared/components/dropdown';
import type { BreadcrumbItem } from '@shared/components/breadcrumbs/breadcrumbs.types';
import { ToastService } from '@shared/components/toast/toast.service';
import { ConfirmModalComponent, ConfirmModalData } from '@shared/modal/demo/confirm-modal.component';
import { ModalService } from '@shared/modal/modal.service';

import '../../physical-count-i18n';
import '../../../transfer/transfer-i18n';
import { DocFormShellComponent } from '../../../../account/components/doc-form-shell/doc-form-shell.component';
import { DocImportLinesModalComponent, ImportLinesResult } from '../../../../account/components/doc-import-lines-modal/doc-import-lines-modal.component';
import { SalesLookupsService } from '../../../../account/services/sales-lookups.service';
import { ProductsService } from '../../../../products/services/products.service';
import {
  TransferProductPickerComponent, TransferProductPickerData, TransferProductPickerResult,
} from '../../../transfer/components/transfer-product-picker/transfer-product-picker.component';
import {
  COUNT_TYPE_BY_MODE, CountLine, CountMode, PhysicalCount, differenceOf, enteredOf, expectedOf, isBatchLine, isCountMode, isSerialLine, totalsOf,
} from '../../models/physical-count.model';
import { CountProduct, PhysicalCountService } from '../../services/physical-count.service';
import {
  CountUnitsData, CountUnitsResult, PhysicalCountUnitsModalComponent,
} from '../../components/physical-count-units-modal/physical-count-units-modal.component';

interface Choice { id: string; name: string; }

/**
 * Physical counts -> create / edit (`/inventory/physical-counts/new/:mode`, `/inventory/physical-counts/edit/:id`). Legacy
 * `PhysicalCountFormComponent`. A count has three steps: OPEN (pick the products and type what was counted - the system
 * quantity stays hidden so the count is blind), CALCULATED (the counted quantities are set against what the system holds,
 * with the difference and its value) and CLOSED ("commit": the backend posts the stock movements and the journal). A closed
 * count can't be edited. The start differs by `:mode`: pick products, count the whole branch, one or more inventory
 * locations, or one or more categories.
 */
@Component({
  selector: 'app-physical-count-form',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslateModule, DocFormShellComponent, SearchDropdownComponent],
  templateUrl: './physical-count-form.component.html',
  styleUrl: './physical-count-form.component.scss',
})
export class PhysicalCountFormComponent implements OnInit, CanLeaveComponent {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private location = inject(Location);
  private lang = inject(LanguageService);
  private toast = inject(ToastService);
  private modal = inject(ModalService);
  private service = inject(PhysicalCountService);
  private lookups = inject(SalesLookupsService);
  private products = inject(ProductsService);
  private privileges = inject(PrivilegeService);

  readonly canCalculate = this.privileges.check('inventoryPhysicalCountsSecurity.actions.calculateLines.access');
  readonly canCommit = this.privileges.check('inventoryPhysicalCountsSecurity.actions.commitLines.access');

  c: PhysicalCount | null = null;
  isNew = true;
  mode: CountMode | null = null;
  branches: Choice[] = [];
  locations: Choice[] = [];
  pickedLocations: Choice[] = [];
  pickedCategories: Choice[] = [];
  breadcrumbs: BreadcrumbItem[] = [];
  submitting = false;
  loadingProducts = false;
  showErrors = false;
  filterTerm = '';
  private dirty = false;
  private saved = false;

  async ngOnInit(): Promise<void> {
    // The shell and import dialog use the shared document strings (DOC_FORM, DOC_IMPORT, ...); the product picker is the transfer one.
    await Promise.all([
      this.lang.loadFeature('inventory/physical-count'), this.lang.loadFeature('inventory/transfer'), this.lang.loadFeature('account/components/doc-lines-table'),
    ]);
    const id = this.route.snapshot.paramMap.get('id');
    const mode = this.route.snapshot.paramMap.get('mode');
    this.isNew = !id;
    this.mode = isCountMode(mode) ? mode : null;

    this.branches = (await this.lookups.getBranches()).map((b: any) => ({ id: b.id, name: b.name }));

    if (id) {
      const loaded = await this.service.getById(id);
      if (!loaded) {
        this.toast.error('COMMON.OPS', this.lang.instant('PHYSICAL_COUNT.NOT_FOUND'));
        void this.router.navigate(['/inventory/physical-counts']);
        return;
      }
      if (loaded.status === 'Closed') {
        // A closed count has moved stock: show it instead.
        void this.router.navigate(['/inventory/physical-counts/view', id], { replaceUrl: true });
        return;
      }
      // Batches received after the count was opened can still be counted.
      await Promise.all(loaded.lines.filter(isBatchLine).map(async l => { l.batches.push(...await this.service.missingBatches(l, loaded.branchId)); }));
      this.c = loaded;
    } else if (this.mode) {
      this.c = {
        id: '', reference: '', status: 'Open', note: '', type: COUNT_TYPE_BY_MODE[this.mode], branchId: this.branches[0]?.id ?? '', branchName: '',
        createdDate: new Date().toISOString(), calculatedDate: null, closedDate: null, createdEmployeeId: null, calculatedEmployeeId: null,
        closedEmployeeId: null, createdEmployeeName: '', calculatedEmployeeName: '', closedEmployeeName: '', lines: [],
      };
      if (this.mode === 'by-inventory') void this.loadLocations();
    }
    this.buildBreadcrumbs();
    this.dirty = false;
  }

  hasUnsavedChanges(): boolean { return this.dirty && !this.saved; }
  mark(): void { this.dirty = true; }

  private buildBreadcrumbs(): void {
    const l = (k: string) => this.lang.instant('PHYSICAL_COUNT.' + k);
    this.breadcrumbs = [
      { label: l('DASHBOARD'), routerLink: '/dashboard' },
      { label: l('TITLE'), routerLink: '/inventory/physical-counts' },
      { label: l(this.isNew ? 'FORM_NEW' : 'FORM_EDIT') },
    ];
  }

  get title(): string { return this.lang.instant('PHYSICAL_COUNT.' + (this.isNew ? 'FORM_NEW' : 'FORM_EDIT')); }

  // ── state helpers ──────────────────────────────────────────────────
  get isOpen(): boolean { return this.c?.status === 'Open'; }
  get isCalculated(): boolean { return this.c?.status === 'Calculated'; }
  get liveLines(): CountLine[] { return (this.c?.lines ?? []).filter(l => !l.isDeleted); }
  get shownLines(): CountLine[] {
    const q = this.filterTerm.trim().toLowerCase();
    return q
      ? this.liveLines.filter(l => l.productName.toLowerCase().includes(q) || (l.barcode ?? '').toLowerCase().includes(q) || (l.categoryName ?? '').toLowerCase().includes(q))
      : this.liveLines;
  }
  /** The branch is fixed once the count has products (a count belongs to one branch) or was saved. */
  get branchLocked(): boolean { return !this.isNew || this.liveLines.length > 0; }
  /** The start step shows until the first product is in. */
  get showStart(): boolean { return this.isNew && this.isOpen && this.liveLines.length === 0; }
  get totals() { return totalsOf(this.c?.lines ?? []); }
  get totalQty(): number { return this.liveLines.reduce((s, l) => s + enteredOf(l), 0); }

  choiceOf = (list: Choice[], id: string | null | undefined) => list.find(c => c.id === id) ?? null;
  label = (c: Choice) => c?.name ?? '';
  byId = (x: Choice, y: Choice) => x?.id === y?.id;

  entered = enteredOf;
  expected = expectedOf;
  diff = differenceOf;
  isBatch = isBatchLine;
  isSerial = isSerialLine;
  hasUnits = (l: CountLine) => isBatchLine(l) || isSerialLine(l);

  // ── start step ─────────────────────────────────────────────────────
  onBranch(c: Choice | null): void {
    const d = this.c!;
    if (!c || c.id === d.branchId || this.branchLocked) return;
    d.branchId = c.id;
    this.pickedLocations = [];
    if (this.mode === 'by-inventory') void this.loadLocations();
    this.mark();
  }

  private async loadLocations(): Promise<void> {
    this.locations = this.c?.branchId ? await this.service.getLocations(this.c.branchId) : [];
  }

  /** Categories are loaded page by page by the dropdown. */
  loadCategories: DropdownLoadFn<Choice> = async ({ page, pageSize, search }) => {
    const res = await this.products.getCategories({ page, pageSize, search });
    return { items: res.items.map((i: any) => ({ id: String(i.value), name: String(i.label) })), hasMore: res.hasMore };
  };

  /** "By all products / inventory / category": the products to count come from the backend, filtered by the choice made. */
  get canLoad(): boolean {
    if (!this.c?.branchId) return false;
    if (this.mode === 'by-inventory') return this.pickedLocations.length > 0;
    if (this.mode === 'by-category') return this.pickedCategories.length > 0;
    return true;
  }

  async loadProducts(): Promise<void> {
    const d = this.c!;
    if (!this.canLoad || this.loadingProducts) return;
    this.loadingProducts = true;
    try {
      let list: CountProduct[] = [];
      if (this.mode === 'by-all-products') list = await this.service.getAllBranchProducts(d.branchId);
      else if (this.mode === 'by-inventory') list = await this.service.getProductsByInventory(d.branchId, this.pickedLocations.map(l => l.id));
      else if (this.mode === 'by-category') list = await this.service.getProductsByCategory(d.branchId, this.pickedCategories.map(l => l.id));
      if (!list.length) { this.toast.error('COMMON.OPS', this.lang.instant('PHYSICAL_COUNT.NO_PRODUCTS_FOUND')); return; }
      await this.addProducts(list);
    } finally {
      this.loadingProducts = false;
    }
  }

  // ── lines ──────────────────────────────────────────────────────────
  /** Adds the products that are not on the count yet (a removed line of a saved count comes back). */
  private async addProducts(list: CountProduct[]): Promise<CountLine[]> {
    const d = this.c!;
    const have = new Map(d.lines.map(l => [l.productId, l]));
    const fresh: CountLine[] = [];
    const todo = list.filter(p => {
      const line = have.get(p.id);
      if (line) { line.isDeleted = false; return false; }
      return true;
    });
    const made = await Promise.all(todo.map(p => this.service.newLine(p, d.branchId)));
    made.forEach(l => { d.lines.push(l); fresh.push(l); });
    this.mark();
    return fresh;
  }

  async pickProducts(): Promise<void> {
    const d = this.c!;
    if (!d.branchId || !this.isOpen) return;
    const res = await this.modal.open<TransferProductPickerComponent, TransferProductPickerData, TransferProductPickerResult | null>(TransferProductPickerComponent, {
      size: 'md',
      data: { branchId: d.branchId, selectedIds: this.liveLines.map(l => l.productId), isTransferOut: false },
    }).afterClosed();
    if (!res) return;
    const keep = new Set(res.ids);
    // Unticked products leave the count, except lines that were already saved (those are removed with the delete button).
    d.lines = d.lines.filter(l => keep.has(l.productId) || !!l.id);
    await this.addProducts(res.products.filter(p => keep.has(p.id)));
  }

  async importLines(): Promise<void> {
    const d = this.c!;
    const res = await this.modal.open<DocImportLinesModalComponent, void, ImportLinesResult | null>(DocImportLinesModalComponent, { size: 'lg' }).afterClosed();
    if (!res?.lines?.length) return;
    const rows = res.lines.filter(l => l.barcode);
    const found = await this.service.getProductsByBarcodes(rows.map(r => r.barcode), d.branchId);
    const byCode = new Map(found.map(p => [String(p.barcode), p]));
    const missing: string[] = [];
    for (const row of rows) {
      const p = byCode.get(String(row.barcode));
      if (!p) { missing.push(row.barcode); continue; }
      const added = await this.addProducts([p]);
      const line = added[0] ?? d.lines.find(l => l.productId === p.id);
      // A plain product takes the imported quantity (a row without one counts one more); serials and batches are counted in their dialog.
      if (line && !this.hasUnits(line)) line.enteredQty = Number(row.qty) > 0 ? Number(row.qty) : line.enteredQty + 1;
    }
    if (missing.length) this.toast.error('COMMON.OPS', this.lang.instant('PHYSICAL_COUNT.NOT_IMPORTED', { list: missing.join(', ') }));
    this.mark();
  }

  removeLine(l: CountLine): void {
    if (!this.isOpen) return;
    const d = this.c!;
    if (l.id) l.isDeleted = true; else d.lines = d.lines.filter(x => x !== l);
    this.mark();
  }

  setQty(l: CountLine, v: unknown): void { l.enteredQty = Math.max(0, Number(v) || 0); this.mark(); }

  async openUnits(l: CountLine): Promise<void> {
    const readOnly = !this.isOpen;
    const res = await this.modal.open<PhysicalCountUnitsModalComponent, CountUnitsData, CountUnitsResult | null>(PhysicalCountUnitsModalComponent, {
      size: 'md', data: { line: l, readOnly },
    }).afterClosed();
    if (!res || readOnly) return;
    l.serials = res.serials;
    l.batches = res.batches;
    this.mark();
  }

  // ── steps: calculate / re-calculate / commit ───────────────────────
  private async confirm(titleKey: string, messageKey: string): Promise<boolean> {
    return !!(await this.modal.open<ConfirmModalComponent, ConfirmModalData, boolean>(ConfirmModalComponent, {
      size: 'sm',
      data: { title: this.lang.instant(titleKey), message: this.lang.instant(messageKey) },
    }).afterClosed());
  }

  async calculate(): Promise<void> {
    const d = this.c!;
    if (!this.liveLines.length || !this.isOpen) return;
    if (!(await this.confirm('PHYSICAL_COUNT.CALCULATE_TITLE', 'PHYSICAL_COUNT.CALCULATE_TEXT'))) return;
    d.status = 'Calculated';
    d.calculatedDate = new Date().toISOString();
    this.mark();
    this.toast.success('PHYSICAL_COUNT.CALCULATED');
  }

  async recalculate(): Promise<void> {
    const d = this.c!;
    if (!this.isCalculated || !this.canCalculate) return;
    if (!(await this.confirm('PHYSICAL_COUNT.RECALCULATE_TITLE', 'PHYSICAL_COUNT.RECALCULATE_TEXT'))) return;
    d.status = 'Open';
    d.calculatedDate = null;
    d.calculatedEmployeeId = null;
    this.mark();
  }

  async commit(): Promise<void> {
    const d = this.c!;
    if (!this.isCalculated || !this.canCommit) return;
    if (!(await this.confirm('PHYSICAL_COUNT.COMMIT_TITLE', 'PHYSICAL_COUNT.COMMIT_TEXT'))) return;
    const before = { status: d.status, closedDate: d.closedDate };
    d.status = 'Closed';
    d.closedDate = new Date().toISOString();
    if (!(await this.persist())) { d.status = before.status; d.closedDate = before.closedDate; }
  }

  // ── validation + save ──────────────────────────────────────────────
  get missing(): string[] {
    const out: string[] = [];
    if (!this.c?.branchId) out.push('BRANCH');
    if (!this.liveLines.length) out.push('LINES');
    return out;
  }

  async save(): Promise<void> {
    this.showErrors = true;
    if (this.missing.length) return;
    await this.persist();
  }

  /** Saves the count as it stands; returns whether the backend accepted it. */
  private async persist(): Promise<boolean> {
    this.submitting = true;
    try {
      const res = await this.service.save(this.c!);
      if (res?.success) {
        this.saved = true;
        this.toast.success(this.c!.status === 'Closed' ? 'PHYSICAL_COUNT.COMMITTED' : 'PHYSICAL_COUNT.SAVED');
        void this.router.navigate(['/inventory/physical-counts']);
        return true;
      }
      this.toast.error('COMMON.OPS', typeof res?.msg === 'string' ? res.msg : this.lang.instant('PHYSICAL_COUNT.SAVE_FAILED'));
      return false;
    } catch (e: any) {
      this.toast.error('COMMON.OPS', e?.error?.msg ?? e?.message ?? this.lang.instant('PHYSICAL_COUNT.SAVE_FAILED'));
      return false;
    } finally {
      this.submitting = false;
    }
  }

  cancel(): void {
    if (window.history.length > 1) this.location.back(); else void this.router.navigate(['/inventory/physical-counts']);
  }
  view(): void { if (this.c?.id) void this.router.navigate(['/inventory/physical-counts/view', this.c.id]); }
}
