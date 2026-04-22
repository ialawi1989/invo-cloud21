import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormGroup, ReactiveFormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';

import { ModalService } from '@shared/modal/modal.service';

import { ProductsService } from '../../../../services/products.service';
import { Product } from '../../../../models/product-form.model';
import { Fields } from '../../../../models/product-fields.model';
import {
  PickProductModalComponent,
  PickProductModalData,
  PickedProduct,
} from '../pick-product-modal/pick-product-modal.component';

/**
 * alt-product
 * ───────────
 * List of alternative products to recommend when the primary item is
 * out-of-stock. Stores an array of product ids on `productInfo
 * .alternativeProducts`, with a display cache on `alternativeProductsTemp`
 * for names — we pick from the same PickProductModal used elsewhere.
 */
@Component({
  selector: 'app-pf-alt-product',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, TranslateModule],
  templateUrl: './alt-product.component.html',
  styleUrl: './alt-product.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AltProductComponent implements OnInit {
  private modal    = inject(ModalService);
  private products = inject(ProductsService);

  productInfo   = input.required<Product>();
  productForm   = input.required<FormGroup>();
  fieldsOptions = input<Fields | null>(null);

  // Bumped after any add/remove so template re-reads productInfo arrays.
  private version = signal<number>(0);

  rows = computed<{ id: string; name: string }[]>(() => {
    void this.version();
    const info = this.productInfo();
    const ids = info.alternativeProducts ?? [];
    const temp = info.alternativeProductsTemp ?? [];
    return ids.map((id: string) => {
      const cached = temp.find((t: any) => t.id === id);
      return { id, name: cached?.name ?? id };
    });
  });

  async ngOnInit(): Promise<void> {
    // No FormGroup control — this section operates on the model directly;
    // dirty state is still tracked via `productForm.markAsDirty()` on change.

    // Edit mode: if the backend returned `alternativeProducts` ids but no
    // matching `alternativeProductsTemp` entries, the names aren't known
    // and the template would fall back to showing the raw UUIDs. Fetch
    // those names in one paged call and populate the display cache so the
    // user sees product names on first paint.
    const info = this.productInfo();
    if (!info) return;
    const ids  = info.alternativeProducts ?? [];
    const temp = info.alternativeProductsTemp ?? [];
    const missing = ids.filter(id => !temp.some((t: any) => t?.id === id));
    if (missing.length === 0) return;

    try {
      const res = await this.products.getProductList({
        page: 1,
        pageSize: Math.max(missing.length, 50),
        search: '',
        ids: missing,
      } as any);
      const list: any[] = res?.list ?? [];
      if (!Array.isArray(info.alternativeProductsTemp)) info.alternativeProductsTemp = [];
      for (const p of list) {
        const id = p.id ?? p._id;
        if (!id || temp.some((t: any) => t.id === id)) continue;
        info.alternativeProductsTemp.push({ id, name: p.name ?? id });
      }
      this.version.update(n => n + 1);
    } catch (e) {
      console.error('[alt-product] failed to resolve alternative names', e);
    }
  }

  async openPicker(): Promise<void> {
    const info = this.productInfo();
    const ref = this.modal.open<PickProductModalComponent, PickProductModalData, PickedProduct[]>(
      PickProductModalComponent,
      {
        data: {
          types: [],
          excludedIds: info.alternativeProducts ?? [],
          multiple: true,
          title: 'Add alternative products',
        },
        size: 'md',
      },
    );
    const picked = await ref.afterClosed();
    if (!picked?.length) return;

    if (!Array.isArray(info.alternativeProducts))     info.alternativeProducts = [];
    if (!Array.isArray(info.alternativeProductsTemp)) info.alternativeProductsTemp = [];
    picked.forEach((p) => {
      if (info.alternativeProducts.includes(p.id)) return;
      info.alternativeProducts.push(p.id);
      info.alternativeProductsTemp.push({ id: p.id, name: p.name });
    });
    this.productForm().markAsDirty();
    this.version.update((n) => n + 1);
  }

  removeAt(id: string): void {
    const info = this.productInfo();
    info.alternativeProducts = info.alternativeProducts.filter((x: string) => x !== id);
    info.alternativeProductsTemp = (info.alternativeProductsTemp ?? []).filter((t: any) => t.id !== id);
    this.productForm().markAsDirty();
    this.version.update((n) => n + 1);
  }
}
