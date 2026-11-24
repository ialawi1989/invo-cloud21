import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

import { ModalRef } from '@shared/modal/modal.service';
import { MODAL_DATA, MODAL_REF } from '@shared/modal/modal.tokens';
import { ModalHeaderComponent } from '@shared/modal/modal-header.component';
import { ModalFooterComponent } from '@shared/modal/modal-footer.component';
import { resolveLocalizedName } from '@shared/utils/localized-name';

import { ProductsService } from '../../../services/products.service';
import { buildChildrenBody } from '../../../services/product-list-requests';

export interface ChooseChildrenData {
  parentId: string;
  parentName: string;
}

/** One child, in the same light shape the bulk-print rows use. */
export interface ChildChoice {
  id: string;
  name: string;
  barcode?: string;
  sku?: string;
  UOM?: string;
  unitCost?: number;
  price?: number;
  type?: string;
  /** Raw list row, kept so the label can read it before the full product loads. */
  raw: any;
}

/** `productChildsList` caps a page at 100 rows. */
const PAGE_SIZE = 100;

/**
 * Choose-children modal for the label print page: lists every child of a parent product (name, barcode, SKU, UOM)
 * with checkboxes and a "Select all" toggle, and returns the ticked children.
 */
@Component({
  selector: 'app-choose-children-modal',
  standalone: true,
  imports: [TranslateModule, ModalHeaderComponent, ModalFooterComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './choose-children-modal.component.html',
  styleUrl: './choose-children-modal.component.scss',
})
export class ChooseChildrenModalComponent implements OnInit {
  private ref = inject<ModalRef<ChildChoice[]>>(MODAL_REF);
  private products = inject(ProductsService);
  private translate = inject(TranslateService);
  data = inject<ChooseChildrenData>(MODAL_DATA);

  loading = signal(true);
  error = signal(false);
  children = signal<ChildChoice[]>([]);
  picked = signal<ReadonlySet<string>>(new Set());

  allPicked = computed(() => this.children().length > 0 && this.picked().size === this.children().length);

  ngOnInit(): void { void this.load(); }

  async load(): Promise<void> {
    this.loading.set(true);
    this.error.set(false);
    try {
      const all: ChildChoice[] = [];
      for (let page = 1; ; page++) {
        const res = await this.products.productChildsList(
          buildChildrenBody(this.data.parentId, { page, limit: PAGE_SIZE, sortBy: { sortValue: 'name', sortDirection: 'asc' } }),
        );
        for (const r of res.list ?? []) {
          all.push({
            id: r.id ?? r._id,
            name: resolveLocalizedName(r, this.translate.currentLang),
            barcode: r.barcode,
            sku: r.sku ?? r.SKU,
            UOM: r.UOM,
            unitCost: r.unitCost,
            price: r.defaultPrice,
            type: r.type,
            raw: r,
          });
        }
        if (res.hasNext !== true || !(res.list ?? []).length) break;
      }
      this.children.set(all);
    } catch {
      this.error.set(true);
    } finally {
      this.loading.set(false);
    }
  }

  isPicked(id: string): boolean { return this.picked().has(id); }

  toggle(id: string): void {
    const next = new Set(this.picked());
    if (!next.delete(id)) next.add(id);
    this.picked.set(next);
  }

  toggleAll(): void {
    this.picked.set(this.allPicked() ? new Set() : new Set(this.children().map(c => c.id)));
  }

  confirm(): void {
    const ids = this.picked();
    this.ref.close(this.children().filter(c => ids.has(c.id)));
  }

  cancel(): void { this.ref.dismiss(); }
}
