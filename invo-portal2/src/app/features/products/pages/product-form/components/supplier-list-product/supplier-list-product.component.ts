import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
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
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TranslateModule } from '@ngx-translate/core';

import { ModalService } from '@shared/modal/modal.service';
import { QtyInputComponent } from '@shared/components/qty-input';
import type { SupplierMini } from '../../../../../suppliers';

import { Product, SupplierItem } from '../../../../models/product-form.model';
import { Fields } from '../../../../models/product-fields.model';
import {
  PickSupplierModalComponent,
  PickSupplierModalData,
  PickSupplierResult,
} from './pick-supplier-modal/pick-supplier-modal.component';

/**
 * supplier-list-product
 * ─────────────────────
 * Per-supplier pricing / min-order card. FormArray of FormGroups — no
 * ngModel; the UI reads name/code directly from the underlying supplier
 * object on `productInfo.suppliers` and writes editable fields (code,
 * minOrder, cost) through FormControls.
 *
 * Soft-delete: removing a persisted supplier (has an id) sets `isDeleted`
 * so the backend knows to drop the link. Newly-added suppliers that were
 * never saved are spliced out.
 */
@Component({
  selector: 'app-pf-supplier-list-product',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, TranslateModule, QtyInputComponent],
  templateUrl: './supplier-list-product.component.html',
  styleUrl: './supplier-list-product.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SupplierListProductComponent implements OnInit {
  private fb = inject(FormBuilder);
  private destroyRef = inject(DestroyRef);
  private modal = inject(ModalService);

  productInfo   = input.required<Product>();
  productForm   = input.required<FormGroup>();
  fieldsOptions = input<Fields | null>(null);

  // One FormGroup per visible (non-deleted) supplier.
  rows!: FormArray<FormGroup>;
  // Searchable filter (visible-only filter; server is not hit).
  searchTerm = signal<string>('');

  /**
   * Bumped after every mutation of `productInfo().suppliers` (add / remove /
   * soft-delete). The `visible` computed reads this signal so array-in-place
   * mutations propagate to the UI — `productInfo` itself is the same Product
   * reference across mutations, so a signal that tracks reference identity
   * alone would miss them.
   */
  private suppliersTick = signal(0);

  // Visible suppliers (filtered by search). We index by absolute position
  // in productInfo.suppliers to stay aligned with FormArray rows.
  visible = computed<Array<{ absIdx: number; s: SupplierItem }>>(() => {
    void this.suppliersTick();
    const term = this.searchTerm().trim().toLowerCase();
    return this.productInfo().suppliers
      .map((s, idx) => ({ absIdx: idx, s }))
      .filter(({ s }) => !s['isDeleted'])
      .filter(({ s }) =>
        !term || (s.supplierName ?? '').toLowerCase().includes(term),
      );
  });

  selectedCount = computed(() => this.visible().length);

  ngOnInit(): void {
    const info = this.productInfo();
    if (!Array.isArray(info.suppliers)) info.suppliers = [];

    this.rows = this.fb.array(
      info.suppliers
        .filter((s: any) => !s.isDeleted)
        .map((s) => this.buildRow(s)),
    );
    this.productForm().setControl('suppliers', this.rows);

    // One-way sync: FormArray values → productInfo.suppliers rows.
    this.rows.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.syncBackToModel());
  }

  private buildRow(s: SupplierItem): FormGroup {
    const f = this.fieldsOptions()?.suppliers;
    return this.fb.group({
      supplierId:   [s.supplierId ?? ''],
      supplierName: [s.supplierName ?? ''],
      code:       [s.supplierCode ?? '',
                   f?.code?.isRequired ? [Validators.required] : []],
      minimumOrder: [s.minimumOrder ?? 0,
                     f?.minOrder?.isRequired ? [Validators.required, Validators.min(0)] : [Validators.min(0)]],
      cost:         [s.cost ?? 0,
                     f?.unitCost?.isRequired ? [Validators.required, Validators.min(0)] : [Validators.min(0)]],
    });
  }

  /**
   * Walks the FormArray and writes each row's values back to the matching
   * productInfo.suppliers entry (matched by `supplierId`). Keeps the model
   * in sync so Product getters like `calculateTotalUnitCostForSuppliers`
   * return fresh values without any two-way ngModel binding.
   */
  private syncBackToModel(): void {
    const info = this.productInfo();
    this.rows.controls.forEach((grp) => {
      const v = grp.getRawValue() as any;
      const target = info.suppliers.find((x: any) => x.supplierId === v.supplierId);
      if (!target) return;
      (target as any).supplierCode = v.code ?? '';
      target.minimumOrder = Number(v.minimumOrder ?? 0);
      target.cost         = Number(v.cost ?? 0);
    });
  }

  onSearchInput(value: string): void {
    this.searchTerm.set(value);
  }

  clearSearch(): void {
    this.searchTerm.set('');
  }

  async openPickSupplier(): Promise<void> {
    const info = this.productInfo();
    const excludedIds = info.suppliers
      .filter((s: any) => !s.isDeleted)
      .map((s: any) => s.supplierId);

    const ref = this.modal.open<
      PickSupplierModalComponent,
      PickSupplierModalData,
      PickSupplierResult
    >(PickSupplierModalComponent, { data: { excludedIds }, size: 'md' });

    const result = await ref.afterClosed();
    if (!result) return;
    if (!result.added.length && !result.removed.length) return;

    if (result.removed.length) {
      const removeSet = new Set(result.removed);
      const info = this.productInfo();
      // Find absIdx for each removed supplierId and re-use existing soft-delete logic.
      removeSet.forEach((supplierId) => {
        const absIdx = info.suppliers.findIndex((s: any) => s.supplierId === supplierId && !s.isDeleted);
        if (absIdx >= 0) this.removeSupplier(absIdx);
      });
    }
    result.added.forEach((supplier) => this.attachSupplier(supplier));
    this.suppliersTick.update((n) => n + 1);
    this.productForm().markAsDirty();
  }

  private attachSupplier(supplier: SupplierMini): void {
    const info = this.productInfo();
    // Revive a soft-deleted row if the user re-picks the same supplier.
    const existing = info.suppliers.find((s: any) => s.supplierId === supplier.id);
    if (existing) {
      if ((existing as any).isDeleted) {
        (existing as any).isDeleted = false;
        existing.supplierName = supplier.name;
        this.rows.push(this.buildRow(existing));
      }
      return;
    }
    const row: SupplierItem = {
      supplierId:   supplier.id,
      supplierName: supplier.name,
      supplierCode: '',
      cost:         0,
      minimumOrder: 0,
    };
    info.suppliers.push(row);
    this.rows.push(this.buildRow(row));
  }

  removeSupplier(absIdx: number): void {
    const info = this.productInfo();
    const item: any = info.suppliers[absIdx];
    if (!item) return;

    // Find the row in the FormArray (rows only contain visible, non-deleted).
    const visibleIdx = this.visible().findIndex((v) => v.absIdx === absIdx);
    if (visibleIdx >= 0) this.rows.removeAt(visibleIdx);

    if (item.supplierId) {
      // Persisted — soft delete so the backend drops the link on save.
      item.isDeleted = true;
    } else {
      info.suppliers.splice(absIdx, 1);
    }
    this.suppliersTick.update((n) => n + 1);
    this.productForm().markAsDirty();
  }

  // FormArray row at the absolute product-info index (maps through visible()).
  rowForAbs(absIdx: number): FormGroup | null {
    const visibleIdx = this.visible().findIndex((v) => v.absIdx === absIdx);
    return visibleIdx >= 0 ? (this.rows.at(visibleIdx) as FormGroup) : null;
  }
}
