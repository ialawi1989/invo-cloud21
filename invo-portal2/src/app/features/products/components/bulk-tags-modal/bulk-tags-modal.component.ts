import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

import { withTranslations } from '@core/i18n/with-translations';
import { ModalService, ModalRef } from '@shared/modal/modal.service';
import { MODAL_REF } from '@shared/modal/modal.tokens';
import { ModalHeaderComponent } from '@shared/modal/modal-header.component';
import { ModalFooterComponent } from '@shared/modal/modal-footer.component';
import { ToastService } from '@shared/components/toast/toast.service';
import { SearchDropdownComponent } from '@shared/components/dropdown/search-dropdown.component';

import { ProductsService } from '../../services/products.service';
import {
  PickProductModalComponent,
  PickProductModalData,
  PickProductResult,
  PickedProduct,
} from '../../pages/product-form/components/pick-product-modal/pick-product-modal.component';

/**
 * Bulk Tags — one tag applied to many products in one shot (the
 * inverse of editing tags per-product). Port of the legacy
 * `BulkTagsComponent`: pick or type a tag, build a working set of
 * products via the shared picker, Apply merges the tag into each
 * product's existing tag array.
 *
 * Writes through `product/updateBulkCategoryTagsTranslation`, which
 * — per InvoCloudBack — replaces `categoryId`, `tags` and
 * `translation` wholesale per row. That's why each picked row must
 * carry its *existing* categoryId/translation through untouched:
 * omitting them would wipe those columns, not just leave tags
 * unchanged.
 */
@Component({
  selector: 'app-bulk-tags-modal',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    TranslateModule,
    ModalHeaderComponent,
    ModalFooterComponent,
    SearchDropdownComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './bulk-tags-modal.component.html',
  styleUrl: './bulk-tags-modal.component.scss',
})
export class BulkTagsModalComponent {
  private translate = inject(TranslateService);
  private products   = inject(ProductsService);
  private modal      = inject(ModalService);
  private toast      = inject(ToastService);
  ref = inject<ModalRef<void>>(MODAL_REF);

  constructor() {
    withTranslations('products');
  }

  // ─── Tag field — the shared async search-dropdown (server-side
  //     search + paging over existing tags) with a footer action to
  //     create a brand-new tag from whatever was typed. ─────────────
  private tagDropdown = viewChild<SearchDropdownComponent>('tagDropdown');
  selectedTag = signal<{ label: string; value: string } | null>(null);
  tagQuery    = signal('');

  loadTags = (params: { page: number; pageSize: number; search: string }) =>
    this.products.getProductTags(params);
  display = (item: any) => item?.label ?? '';
  compare = (a: any, b: any) => (a?.value ?? a) === (b?.value ?? b);

  onTagChange(item: any): void {
    this.selectedTag.set(item ?? null);
  }

  createTag(): void {
    const tag = this.tagQuery().trim();
    if (!tag) return;
    this.selectedTag.set({ label: tag, value: tag });
    this.tagDropdown()?.close();
  }

  tag = computed(() => (this.selectedTag()?.value ?? '').trim());

  // ─── Picked products ─────────────────────────────────────────────
  pickedProducts = signal<PickedProduct[]>([]);

  async openPicker(): Promise<void> {
    const ref = this.modal.open<PickProductModalComponent, PickProductModalData, PickProductResult>(
      PickProductModalComponent,
      {
        size: 'md',
        data: {
          excludedIds: this.pickedProducts().map(p => p.id),
          multiple: true,
          title: this.translate.instant('PRODUCTS.BULK_TAGS.ADD_PRODUCTS'),
        },
      },
    );
    const res = await ref.afterClosed();
    if (!res) return;
    const removedIds = new Set(res.removed);
    const kept = this.pickedProducts().filter(p => !removedIds.has(p.id));
    this.pickedProducts.set([...kept, ...res.added]);
  }

  removeProduct(id: string): void {
    this.pickedProducts.update(list => list.filter(p => p.id !== id));
  }

  clearAll(): void {
    this.pickedProducts.set([]);
  }

  // ─── Apply ───────────────────────────────────────────────────────
  saving = signal(false);
  canApply = computed(() => !!this.tag() && this.pickedProducts().length > 0);

  async apply(): Promise<void> {
    if (!this.canApply() || this.saving()) return;
    const tag = this.tag();
    this.saving.set(true);
    try {
      const list = this.pickedProducts().map(p => ({
        id: p.id,
        categoryId: p.categoryId ?? null,
        tags: p.tags?.includes(tag) ? p.tags : [...(p.tags ?? []), tag],
        translation: p.rawTranslation ?? null,
      }));
      const res = await this.products.updateBulkCategoryTagsTranslation(list);
      if (res?.success === false) throw new Error(res?.msg || res?.message || 'Failed');

      // Reflect the merge locally so the badge list updates without a refetch.
      this.pickedProducts.update(rows =>
        rows.map(p => (p.tags?.includes(tag) ? p : { ...p, tags: [...(p.tags ?? []), tag] })),
      );
      this.toast.success(
        this.translate.instant('PRODUCTS.BULK_TAGS.APPLY_SUCCESS', { count: list.length }),
      );
    } catch (e: any) {
      this.toast.error(this.translate.instant('PRODUCTS.BULK_TAGS.APPLY_FAILED'), e?.message);
    } finally {
      this.saving.set(false);
    }
  }
}
