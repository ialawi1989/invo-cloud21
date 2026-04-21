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
  private modal = inject(ModalService);

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

  ngOnInit(): void {
    // No FormGroup control — this section operates on the model directly;
    // dirty state is still tracked via `productForm.markAsDirty()` on change.
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
