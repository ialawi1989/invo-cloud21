import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CdkDrag, CdkDragDrop, CdkDragHandle, CdkDropList } from '@angular/cdk/drag-drop';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

import { withTranslations } from '@core/i18n/with-translations';
import type { CanLeaveComponent } from '@core/guards/unsaved-changes.guard';
import { PrivilegeService } from '@core/auth/privileges/privilege.service';
import { MycurrencyPipe } from '@core/pipes/mycurrency.pipe';
import { resolveLocalizedName } from '@shared/utils/localized-name';
import { DropdownMenuBtnComponent, DropdownMenuBtnItem } from '@shared/components/dropdown-menu-btn/dropdown-menu-btn.component';
import type { BreadcrumbItem } from '@shared/components/breadcrumbs/breadcrumbs.types';
import { LoadingOverlayComponent } from '@shared/components/spinner/loading-overlay.component';
import { DocFormShellComponent } from '../../../../account/components/doc-form-shell/doc-form-shell.component';
import { SearchDropdownComponent, DropdownLoadParams } from '@shared/components/dropdown';
import { QtyInputComponent } from '@shared/components/qty-input';
import { ToastService } from '@shared/components/toast/toast.service';
import { ModalService } from '@shared/modal/modal.service';
import { ConfirmModalComponent, ConfirmModalData } from '@shared/modal/demo/confirm-modal.component';

import { SupplierMini, SupplierService } from '../../../../suppliers/services/supplier.service';
import { EmployeeService } from '../../../../employees/services/employee.service';
import { SalesLookupsService } from '../../../../account/services/sales-lookups.service';
import {
  InventoryRequest,
  InventoryRequestLine,
  InventoryRequestService,
  LinkedDoc,
  RequestProduct,
} from '../../../services/inventory-request.service';
import { DocItemSearchComponent } from '../../../../account/components/doc-item-search/doc-item-search.component';
import { LanguageService } from '@core/i18n/language.service';
import { InventoryRequestPaperComponent } from '../inventory-request-paper/inventory-request-paper.component';

interface Option { id: string; name: string; translation?: any }
interface Priority { value: string; labelKey: string }

/** One editable row. A row with no `productId` is the trailing "pick a product" row. */
interface FormLine {
  uid: number;
  /** `''` until the line has been saved. */
  id: string;
  productId: string;
  name: string;
  translation?: any;
  barcode: string;
  uom: string;
  unitCost: number;
  qty: number;
  supplier: SupplierMini | null;
  priority: string;
}

let uid = 0;
const blankLine = (supplier: SupplierMini | null): FormLine => ({
  uid: ++uid, id: '', productId: '', name: '', barcode: '', uom: '', unitCost: 0, qty: 1, supplier, priority: 'Normal',
});

/**
 * Inventory request → form (`/inventory/request/:id`, `new` to create). Ported from
 * InvoCloudFront2's `inventory-request-form`: branch, optional "assign supplier for all", a lines table
 * (product picker, qty, cost, supplier, priority, total — with the always-present trailing picker row),
 * Save, Print and "Convert To Purchase Order" (shown once every line has a supplier).
 */
@Component({
  selector: 'app-inventory-request-form',
  standalone: true,
  imports: [
    CommonModule, RouterLink, FormsModule, TranslateModule, DocFormShellComponent, LoadingOverlayComponent,
    CdkDropList, CdkDrag, CdkDragHandle, DropdownMenuBtnComponent, SearchDropdownComponent, QtyInputComponent, MycurrencyPipe,
    InventoryRequestPaperComponent, DocItemSearchComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './inventory-request-form.component.html',
  styleUrl: './inventory-request-form.component.scss',
})
export class InventoryRequestFormComponent implements OnInit, CanLeaveComponent {
  private service = inject(InventoryRequestService);
  private suppliers = inject(SupplierService);
  private employees = inject(EmployeeService);
  private lookups = inject(SalesLookupsService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private translate = inject(TranslateService);
  private toast = inject(ToastService);
  private modal = inject(ModalService);
  private privileges = inject(PrivilegeService);
  private langs = inject(LanguageService);

  readonly canConvertPo = this.privileges.check('purchaseOrderSecurity.actions.convert.access');

  loading = signal(false);
  saving = signal(false);
  submitted = signal(false);
  dirty = signal(false);

  requestId = signal<string | null>(null);
  isNew = computed(() => this.requestId() === null);
  request = signal<InventoryRequest | null>(null);

  branches = signal<Option[]>([]);
  branch = signal<Option | null>(null);
  employeeName = signal('');
  supplierForAll = signal<SupplierMini | null>(null);
  lines = signal<FormLine[]>([]);

  readonly priorities: Priority[] = [
    { value: 'High', labelKey: 'PRODUCTS.INVENTORY_REQUEST.PRIORITY_HIGH' },
    { value: 'Normal', labelKey: 'PRODUCTS.INVENTORY_REQUEST.PRIORITY_NORMAL' },
    { value: 'Low', labelKey: 'PRODUCTS.INVENTORY_REQUEST.PRIORITY_LOW' },
  ];

  private i18nTick = signal(0);

  breadcrumbs = computed<BreadcrumbItem[]>(() => {
    this.i18nTick();
    return [
      { label: this.translate.instant('PRODUCTS.INVENTORY_REQUEST.TITLE'), routerLink: '/inventory/request' },
      { label: this.translate.instant(this.isNew() ? 'PRODUCTS.INVENTORY_REQUEST.NEW' : 'PRODUCTS.INVENTORY_REQUEST.EDIT') },
    ];
  });

  pageTitle = computed(() => {
    this.i18nTick();
    return this.translate.instant('PRODUCTS.INVENTORY_REQUEST.FORM_TITLE');
  });

  /** Lines that have a product (excludes the trailing picker row). */
  productLines = computed(() => this.lines().filter((l) => !!l.productId));
  total = computed(() => this.productLines().reduce((s, l) => s + l.unitCost * l.qty, 0));
  totalQty = computed(() => this.productLines().reduce((s, l) => s + (Number(l.qty) || 0), 0));

  /** Extra actions in the save bar's split-button menu (same place the invoice form puts them). */
  saveMenu = computed<DropdownMenuBtnItem[]>(() => {
    this.i18nTick();
    const items: DropdownMenuBtnItem[] = [];
    if (!this.isNew()) {
      items.push({ label: this.translate.instant('COMMON.PRINT'), click: () => this.print(), disabled: false, danger: false });
      if (this.canConvertPo && this.allHaveSuppliers() && !this.hasErrors()) {
        items.push({ label: this.translate.instant('PRODUCTS.INVENTORY_REQUEST.CONVERT_TO_PO'), click: () => void this.convertToPo(), disabled: false, danger: false });
      }
    }
    return items;
  });

  lastIsPicker = computed(() => {
    const ls = this.lines();
    return ls.length > 0 && !ls[ls.length - 1].productId;
  });

  // ── validation ────────────────────────────────────────────────────────────
  branchInvalid = computed(() => !this.branch());
  noLines = computed(() => this.productLines().length === 0);
  badQty = (l: FormLine) => !(l.qty > 0);
  hasErrors = computed(() => this.branchInvalid() || this.noLines() || this.productLines().some((l) => this.badQty(l)));
  /** Every product line has a supplier — gate for "Convert To Purchase Order". */
  allHaveSuppliers = computed(() => this.productLines().length > 0 && this.productLines().every((l) => !!l.supplier?.id));

  paperData = computed(() => ({
    id: this.requestId() ?? '',
    status: this.request()?.status ?? '',
    createdAt: this.request()?.createdAt ?? new Date(),
    branchName: this.branch()?.name ?? '',
    employeeName: this.employeeName(),
    lines: this.productLines().map((l) => this.toServiceLine(l)),
  }));

  constructor() {
    withTranslations('products');
    this.translate.onTranslationChange.subscribe(() => this.i18nTick.update((n) => n + 1));
    this.translate.onLangChange.subscribe(() => this.i18nTick.update((n) => n + 1));
  }

  async ngOnInit(): Promise<void> {
    const id = this.route.snapshot.paramMap.get('id');
    const creating = !id || id === 'new' || id === '0';
    this.requestId.set(creating ? null : id);
    this.loading.set(true);
    try {
      const [branches] = await Promise.all([
        this.lookups.getBranches().catch(() => []),
        this.langs.loadFeature('account/components/doc-lines-table'),
      ]);
      this.branches.set(branches.map((b: any) => ({ id: String(b.id), name: String(b.name ?? ''), translation: b.translation })));

      if (creating) {
        this.lines.set([blankLine(null)]);
        return;
      }
      const req = await this.service.getById(id!);
      if (!req) {
        this.toast.error('PRODUCTS.INVENTORY_REQUEST.NOT_FOUND');
        void this.router.navigate(['/inventory/request']);
        return;
      }
      this.request.set(req);
      this.branch.set(this.branches().find((b) => b.id === req.branchId) ?? (req.branchId ? { id: req.branchId, name: req.branchName } : null));
      this.lines.set([
        ...req.lines.map((l): FormLine => ({
          uid: ++uid, id: l.id, productId: l.productId, name: l.productName, translation: l.translation,
          barcode: l.barcode, uom: l.uom, unitCost: l.unitCost, qty: l.qty || 1,
          supplier: l.supplierId ? { id: l.supplierId, name: l.supplierName } : null,
          priority: l.priority || 'Normal',
        })),
        blankLine(null),
      ]);
      void this.employees.getList({ page: 1, limit: 999 }).then((r) => {
        this.employeeName.set(r.list.find((e: any) => e.id === req.employeeId)?.name ?? req.employeeName ?? '');
      }).catch(() => undefined);
    } finally {
      this.loading.set(false);
    }
  }

  // ── lookups for the dropdowns ─────────────────────────────────────────────
  branchLabel = (b: Option) => resolveLocalizedName(b, this.translate.currentLang);
  byId = (a: { id: string }, b: { id: string }) => a?.id === b?.id;
  supplierLabel = (s: SupplierMini) => s.name;
  productLabel = (p: RequestProduct) => p.name;
  priorityLabel = (p: Priority) => this.translate.instant(p.labelKey);
  priorityOf = (value: string) => this.priorities.find((p) => p.value === value) ?? this.priorities[1];
  byValue = (a: Priority, b: Priority) => a?.value === b?.value;

  /** Invoice-style item search: the picker panel pages through the products as the user types / scrolls. */
  searchProducts = async (term: string, page: number) => {
    const r = await this.service.getProductsPage({ page, limit: 20, searchTerm: term });
    return { list: r.items, hasNext: r.hasMore };
  };
  /** Enter in the item box: an exact barcode, or the only match. */
  lookupProduct = async (code: string): Promise<RequestProduct | null> => {
    const { items } = await this.service.getProductsPage({ page: 1, limit: 20, searchTerm: code });
    const lc = code.toLowerCase();
    return items.find(p => (p.barcode ?? '').toLowerCase() === lc) ?? (items.length === 1 ? items[0] : null);
  };
  loadSuppliers = (p: DropdownLoadParams) =>
    this.suppliers.getMiniListPage({ page: p.page, limit: p.pageSize, search: p.search });

  // ── edits ─────────────────────────────────────────────────────────────────
  private touch(): void { this.dirty.set(true); }

  setBranch(b: any): void { this.branch.set((b as Option) ?? null); this.touch(); }

  /** Legacy `onSelectSupplierForAll`: stamps the chosen supplier on every line (clearing it clears them). */
  setSupplierForAll(s: any): void {
    const sup = (s as SupplierMini) ?? null;
    this.supplierForAll.set(sup);
    this.lines.update((ls) => ls.map((l) => ({ ...l, supplier: sup })));
    this.touch();
  }

  /** Legacy `chooseItem`: fills the row from the product, then appends a fresh picker row. */
  pickProduct(line: FormLine, p: any): void {
    const prod = p as RequestProduct | null;
    if (!prod) return;
    this.lines.update((ls) => {
      const next = ls.map((l) => l.uid !== line.uid ? l : {
        ...l,
        productId: prod.id,
        name: prod.name,
        translation: undefined,
        barcode: prod.barcode,
        uom: prod.uom,
        unitCost: prod.unitCost > 0 ? prod.unitCost : l.unitCost,
        qty: 1,
      });
      return next[next.length - 1].productId ? [...next, blankLine(this.supplierForAll())] : next;
    });
    this.touch();
  }

  patch(line: FormLine, change: Partial<FormLine>): void {
    this.lines.update((ls) => ls.map((l) => (l.uid === line.uid ? { ...l, ...change } : l)));
    this.touch();
  }

  setSupplier(line: FormLine, s: any): void { this.patch(line, { supplier: (s as SupplierMini) ?? null }); }
  setPriority(line: FormLine, p: any): void { this.patch(line, { priority: (p as Priority)?.value ?? 'Normal' }); }
  setQty(line: FormLine, q: number): void { this.patch(line, { qty: Number(q) || 0 }); }

  addLine(): void {
    if (this.lastIsPicker()) return;
    this.lines.update((ls) => [...ls, blankLine(this.supplierForAll())]);
  }

  /** Reorder product rows; the trailing "pick a product" row always stays last. */
  drop(event: CdkDragDrop<unknown>): void {
    const ls = [...this.lines()];
    const productCount = ls.filter((l) => !!l.productId).length;
    const from = event.previousIndex;
    const to = Math.min(event.currentIndex, productCount - 1);
    if (from === to || from >= productCount) return;
    const [moved] = ls.splice(from, 1);
    ls.splice(to, 0, moved);
    this.lines.set(ls);
    this.touch();
  }

  // -- scan item --------------------------------------------------------------
  scanOpen = signal(false);
  scanMessage = signal('');

  /** Look the code up by barcode / SKU / name and add it (or bump the qty if it is already a line). */
  async onScan(input: HTMLInputElement): Promise<void> {
    const code = input.value.trim();
    if (!code) return;
    this.scanMessage.set('');
    try {
      const { items } = await this.service.getProductsPage({ page: 1, limit: 20, searchTerm: code });
      const lc = code.toLowerCase();
      const hit = items.find((p) => (p.barcode ?? '').toLowerCase() === lc) ?? (items.length === 1 ? items[0] : null);
      if (!hit) {
        this.scanMessage.set(this.translate.instant('PRODUCTS.INVENTORY_REQUEST.SCAN_NOT_FOUND', { code }));
        return;
      }
      const existing = this.lines().find((l) => l.productId === hit.id);
      if (existing) {
        this.patch(existing, { qty: existing.qty + 1 });
      } else {
        if (!this.lastIsPicker()) this.addLine();
        const picker = this.lines()[this.lines().length - 1];
        this.pickProduct(picker, hit);
      }
      input.value = '';
    } catch {
      this.scanMessage.set(this.translate.instant('PRODUCTS.INVENTORY_REQUEST.SCAN_NOT_FOUND', { code }));
    }
  }

  // -- bulk actions -----------------------------------------------------------
  bulkMode = signal(false);
  selected = signal<ReadonlySet<number>>(new Set());
  bulkSupplier = signal<SupplierMini | null>(null);

  bulkMenu = computed<DropdownMenuBtnItem[]>(() => {
    this.i18nTick();
    return [{
      label: this.translate.instant('PRODUCTS.INVENTORY_REQUEST.BULK_SELECT'),
      click: () => this.bulkMode.set(true), disabled: false, danger: false,
    }];
  });

  isSelected(l: FormLine): boolean { return this.selected().has(l.uid); }
  toggleSelect(l: FormLine): void {
    const next = new Set(this.selected());
    if (!next.delete(l.uid)) next.add(l.uid);
    this.selected.set(next);
  }
  allSelected = computed(() => this.productLines().length > 0 && this.productLines().every((l) => this.selected().has(l.uid)));
  toggleSelectAll(): void {
    this.selected.set(this.allSelected() ? new Set() : new Set(this.productLines().map((l) => l.uid)));
  }
  closeBulk(): void { this.bulkMode.set(false); this.selected.set(new Set()); this.bulkSupplier.set(null); }

  bulkAssignSupplier(s: any): void {
    const sup = (s as SupplierMini) ?? null;
    this.bulkSupplier.set(sup);
    if (!sup || !this.selected().size) return;
    this.lines.update((ls) => ls.map((l) => (this.selected().has(l.uid) ? { ...l, supplier: sup } : l)));
    this.touch();
  }
  bulkSetPriority(p: any): void {
    const value = (p as Priority | null)?.value;
    if (!value || !this.selected().size) return;
    this.lines.update((ls) => ls.map((l) => (this.selected().has(l.uid) ? { ...l, priority: value } : l)));
    this.touch();
  }
  async bulkRemove(): Promise<void> {
    if (!this.selected().size) return;
    const ok = await this.modal.open<ConfirmModalComponent, ConfirmModalData, boolean>(ConfirmModalComponent, {
      size: 'sm',
      data: { title: this.translate.instant('COMMON.REMOVE'), message: this.translate.instant('PRODUCTS.INVENTORY_REQUEST.CONFIRM_REMOVE_SELECTED', { count: this.selected().size }), danger: true },
    }).afterClosed();
    if (!ok) return;
    this.lines.update((ls) => {
      const next = ls.filter((l) => !this.selected().has(l.uid));
      return next.length && !next[next.length - 1].productId ? next : [...next, blankLine(this.supplierForAll())];
    });
    this.closeBulk();
    this.touch();
  }

  async removeLine(line: FormLine): Promise<void> {
    const ok = await this.modal.open<ConfirmModalComponent, ConfirmModalData, boolean>(ConfirmModalComponent, {
      size: 'sm',
      data: { title: this.translate.instant('COMMON.REMOVE'), message: this.translate.instant('PRODUCTS.INVENTORY_REQUEST.CONFIRM_REMOVE_LINE'), danger: true },
    }).afterClosed();
    if (!ok) return;
    this.lines.update((ls) => {
      const next = ls.filter((l) => l.uid !== line.uid);
      return next.length && !next[next.length - 1].productId ? next : [...next, blankLine(this.supplierForAll())];
    });
    this.touch();
  }

  lineName(l: FormLine): string {
    return resolveLocalizedName({ name: l.name, translation: l.translation }, this.translate.currentLang);
  }

  // ── persistence ───────────────────────────────────────────────────────────
  private toServiceLine(l: FormLine): InventoryRequestLine {
    return {
      id: l.id, productId: l.productId, productName: l.name, name: l.name, barcode: l.barcode, uom: l.uom,
      translation: l.translation, qty: l.qty, unitCost: l.unitCost, supplierId: l.supplier?.id ?? '',
      supplierName: l.supplier?.name ?? '', priority: l.priority, taxId: '', taxPercentage: 0, taxType: '',
      taxes: [], isInclusiveTax: false,
    };
  }

  private async persist(): Promise<boolean> {
    this.submitted.set(true);
    if (this.hasErrors()) return false;
    this.saving.set(true);
    try {
      const res = await this.service.save({
        id: this.requestId(),
        branchId: this.branch()!.id,
        lines: this.productLines().map((l) => this.toServiceLine(l)),
      });
      if (res?.success) {
        this.dirty.set(false);
        return true;
      }
      this.toast.error('COMMON.SAVE_FAILED', typeof res?.msg === 'string' ? res.msg : '');
      return false;
    } catch (e: any) {
      this.toast.error('COMMON.SAVE_FAILED', e?.error?.msg ?? e?.message ?? '');
      return false;
    } finally {
      this.saving.set(false);
    }
  }

  async save(): Promise<void> {
    if (!(await this.persist())) return;
    this.toast.success('COMMON.SAVED_OK');
    void this.router.navigate(['/inventory/request']);
  }

  /** Legacy `convertToPo`: save the edits, convert, then back to the list. */
  async convertToPo(): Promise<void> {
    const id = this.requestId();
    if (!id || !this.allHaveSuppliers() || !(await this.persist())) return;
    this.saving.set(true);
    try {
      const res = await this.service.convertToPurchaseOrder(id);
      if (res?.success) {
        this.toast.success('COMMON.SAVED_OK');
        void this.router.navigate(['/inventory/request']);
      } else {
        this.toast.error('COMMON.OPS', typeof res?.msg === 'string' ? res.msg : '');
      }
    } catch (e: any) {
      this.toast.error('COMMON.OPS', e?.error?.msg ?? e?.message ?? '');
    } finally {
      this.saving.set(false);
    }
  }

  print(): void { window.print(); }

  cancel(): void { void this.router.navigate(['/inventory/request']); }

  view(): void {
    const id = this.requestId();
    if (id) void this.router.navigate(['/inventory/request', id, 'view']);
  }

  linkedPos = computed<LinkedDoc[]>(() => this.request()?.purchaseOrders ?? []);

  hasUnsavedChanges(): boolean { return this.dirty() && !this.saving(); }
}
