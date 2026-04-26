import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  FormArray,
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

import { SearchDropdownComponent } from '@shared/components/dropdown/search-dropdown.component';
import { ModalService } from '@shared/modal/modal.service';
import {
  ConfirmModalComponent,
  ConfirmModalData,
} from '@shared/modal/demo/confirm-modal.component';

import { ProductCrudService } from '../../../../../services/product-crud.service';
import { Fields } from '../../../../../models/product-fields.model';
import { Product } from '../../../../../models/product-form.model';

type StatusFilter = 'All' | 'Available' | 'Sold';
interface StatusOption { value: StatusFilter; labelKey: string; }

/**
 * branch-serials
 * ──────────────
 * Per-branch serials editor. Ported from InvoCloudFront2's
 * `branch-serials.component` with an enhanced modern UI:
 *   • Serial | Status | Unit Cost | Action table
 *   • All / Available / Sold filter + search
 *   • Bulk-select with "Delete Selected (N)" action
 *   • Totals footer (Available X, Sold Y)
 *   • Barcode + Show-invoice row actions
 *   • Cross-branch duplicate check (serial exists in sibling branch)
 *
 * Row shape:   { serial, status: 'Available' | 'Sold', invoiceId, unitCost }
 * Parent owns the FormArray via [array]; this component only mutates it.
 */
@Component({
  selector: 'app-pf-branch-serials',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    TranslateModule,
    SearchDropdownComponent,
  ],
  templateUrl: './branch-serials.component.html',
  styleUrl: './branch-serials.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BranchSerialsComponent {
  private fb = inject(FormBuilder);
  private translate = inject(TranslateService);
  private modals = inject(ModalService);
  private productCrud = inject(ProductCrudService);

  // ─── Inputs ───────────────────────────────────────────────────────────
  array                = input.required<FormArray<FormGroup>>();
  fieldsOptions        = input<Fields | null>(null);
  productInfo          = input<Product | null>(null);
  /** Lowercased serial strings that exist in OTHER branches — for dup check. */
  otherBranchesSerials = input<Set<string>>(new Set());

  // ─── Local state ──────────────────────────────────────────────────────
  newSerial    = signal<string>('');
  search       = signal<string>('');
  error        = signal<'' | 'DUPLICATE' | 'DUPLICATE_OTHER_BRANCH'>('');
  statusFilter = signal<StatusFilter>('All');

  /** Keys of selected rows — keyed by serial string (unique within branch). */
  private selectedKeys = signal<Set<string>>(new Set());

  /**
   * Bumps on every local FormArray mutation so `computed()` functions pick up
   * push/removeAt. The signal input itself doesn't notify on in-place mutation.
   */
  private arrayTick = signal(0);

  // ─── Filter options for the status dropdown ──────────────────────────
  readonly STATUS_OPTIONS: StatusOption[] = [
    { value: 'All',       labelKey: 'PRODUCTS.FORM.FILTER_ALL' },
    { value: 'Available', labelKey: 'PRODUCTS.FORM.AVAILABLE' },
    { value: 'Sold',      labelKey: 'PRODUCTS.FORM.SOLD' },
  ];
  statusDisplay = (o: StatusOption | StatusFilter): string => {
    const opt = typeof o === 'string'
      ? this.STATUS_OPTIONS.find(x => x.value === o)
      : o;
    return opt ? this.translate.instant(opt.labelKey) : '';
  };
  statusCompare = (a: any, b: any): boolean =>
    (a?.value ?? a) === (b?.value ?? b);
  selectedStatusOption = computed<StatusOption>(() =>
    this.STATUS_OPTIONS.find(o => o.value === this.statusFilter())!,
  );

  // ─── Derived state ────────────────────────────────────────────────────
  /** Filtered rows (indices into `array`) by status + search term. */
  visibleIndices = computed<number[]>(() => {
    this.arrayTick();
    const term   = this.search().trim().toLowerCase();
    const status = this.statusFilter();
    const ids: number[] = [];
    this.array().controls.forEach((row, i) => {
      const v = row.value as { serial?: string; status?: string };
      const s = String(v.serial ?? '').toLowerCase();
      const st = String(v.status ?? 'Available');
      if (status !== 'All' && st !== status) return;
      if (term && !s.includes(term)) return;
      ids.push(i);
    });
    return ids;
  });

  /** Available / Sold totals, respecting current filter (matches old UX). */
  totalAvailable = computed<number>(() => {
    this.arrayTick();
    return this.visibleIndices()
      .map(i => this.array().at(i).value as { status?: string })
      .filter(v => (v.status ?? 'Available') === 'Available').length;
  });
  totalSold = computed<number>(() => {
    this.arrayTick();
    return this.visibleIndices()
      .map(i => this.array().at(i).value as { status?: string })
      .filter(v => v.status === 'Sold').length;
  });

  selectedCount  = computed<number>(() => this.selectedKeys().size);
  isAllSelected  = computed<boolean>(() => {
    const visible = this.visibleIndices();
    if (visible.length === 0) return false;
    const keys = this.selectedKeys();
    return visible.every(i => {
      const s = String((this.array().at(i).value as any).serial ?? '');
      return keys.has(s);
    });
  });

  // ─── Actions ──────────────────────────────────────────────────────────
  addSerial(): void {
    const value = this.newSerial().trim();
    this.error.set('');
    if (!value) return;

    const lower = value.toLowerCase();
    const exists = this.array().controls.some(
      row => String((row.value as any).serial ?? '').toLowerCase() === lower,
    );
    if (exists) {
      this.error.set('DUPLICATE');
      return;
    }
    if (this.otherBranchesSerials().has(lower)) {
      this.error.set('DUPLICATE_OTHER_BRANCH');
      return;
    }

    const defaultCost =
      Number(this.productInfo()?.unitCost ?? 0) || 0;

    this.array().push(this.fb.group({
      serial:    [value, [Validators.required]],
      status:    ['Available'],
      invoiceId: [''],
      unitCost:  [defaultCost, [Validators.required, Validators.min(0)]],
    }));
    this.array().markAsDirty();
    this.newSerial.set('');
    this.arrayTick.update(n => n + 1);
  }

  async removeAt(i: number): Promise<void> {
    if (i < 0 || i >= this.array().length) return;
    const confirmed = await this.confirm({
      title:   this.translate.instant('COMMON.CONFIRM'),
      message: this.translate.instant('COMMON.CONFIRM_CANT_REVERT'),
      confirm: this.translate.instant('COMMON.ACTIONS.DELETE'),
      danger:  true,
    });
    if (!confirmed) return;

    const serial = String((this.array().at(i).value as any).serial ?? '');
    this.array().removeAt(i);
    this.array().markAsDirty();
    this.selectedKeys.update(s => {
      if (!s.has(serial)) return s;
      const next = new Set(s); next.delete(serial); return next;
    });
    this.arrayTick.update(n => n + 1);
  }

  async deleteSelected(): Promise<void> {
    const keys = this.selectedKeys();
    if (keys.size === 0) return;
    const confirmed = await this.confirm({
      title:   this.translate.instant('COMMON.CONFIRM'),
      message: this.translate.instant('PRODUCTS.FORM.CONFIRM_DELETE_SELECTED_SERIALS', { count: keys.size }),
      confirm: this.translate.instant('COMMON.ACTIONS.DELETE'),
      danger:  true,
    });
    if (!confirmed) return;

    // Collect indices to remove and drop them back-to-front to keep indices
    // stable during removal.
    const arr = this.array();
    const toRemove: number[] = [];
    arr.controls.forEach((row, i) => {
      const s = String((row.value as any).serial ?? '');
      if (keys.has(s)) toRemove.push(i);
    });
    toRemove.sort((a, b) => b - a).forEach(i => arr.removeAt(i));
    arr.markAsDirty();
    this.selectedKeys.set(new Set());
    this.arrayTick.update(n => n + 1);
  }

  onBarcode(i: number): void {
    const row = this.array().at(i).value as any;
    const info = this.productInfo();
    if (!info) return;
    this.productCrud.showGenerateBarcode(info, 'serial', row);
  }

  openInvoice(invoiceId: string): void {
    // TODO: wire once an invoices feature is ported. For now, log.
    console.log('[branch-serials] open invoice (TODO):', invoiceId);
  }

  rowAt(i: number): FormGroup {
    return this.array().at(i) as FormGroup;
  }

  // ─── Input handlers ──────────────────────────────────────────────────
  onNewSerialInput(value: string): void {
    this.newSerial.set(value);
    if (this.error()) this.error.set('');
  }
  onSearchInput(value: string): void { this.search.set(value); }
  onStatusFilterChange(opt: StatusOption): void { this.statusFilter.set(opt.value); }

  toggleRow(i: number): void {
    const serial = String((this.array().at(i).value as any).serial ?? '');
    if (!serial) return;
    this.selectedKeys.update(s => {
      const next = new Set(s);
      if (next.has(serial)) next.delete(serial); else next.add(serial);
      return next;
    });
  }
  isRowSelected(i: number): boolean {
    const serial = String((this.array().at(i).value as any).serial ?? '');
    return this.selectedKeys().has(serial);
  }
  toggleSelectAll(): void {
    if (this.isAllSelected()) {
      this.selectedKeys.set(new Set());
      return;
    }
    const next = new Set(this.selectedKeys());
    this.visibleIndices().forEach(i => {
      const s = String((this.array().at(i).value as any).serial ?? '');
      if (s) next.add(s);
    });
    this.selectedKeys.set(next);
  }

  // ─── Internal helpers ────────────────────────────────────────────────
  private async confirm(data: ConfirmModalData): Promise<boolean> {
    const ref = this.modals.open<ConfirmModalComponent, ConfirmModalData, boolean>(
      ConfirmModalComponent,
      { size: 'sm', data },
    );
    const out = await ref.afterClosed();
    return !!out;
  }
}
