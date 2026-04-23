import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormGroup } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';

import { ModalService } from '@shared/modal/modal.service';
import {
  MediaPickerModalComponent,
  MediaPickerConfig,
} from '../../../../../media/components/media-picker/media-picker-modal.component';
import type { Media } from '../../../../../media/models/media.model';

import { Product, ProductMedia } from '../../../../models/product-form.model';
import { Fields } from '../../../../models/product-fields.model';

/**
 * product-gallery
 * ───────────────
 * Multi-image list card. Rows are stored on `productInfo.productMedia`.
 * Click an item to make it the cover (`mediaId` + `mediaUrl`) — the
 * server fallback in `doSaving()` assigns the first media if none is
 * marked, but letting the user pick explicitly is nicer UX.
 */
@Component({
  selector: 'app-pf-product-gallery',
  standalone: true,
  imports: [CommonModule, TranslateModule],
  templateUrl: './product-gallery.component.html',
  styleUrl: './product-gallery.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProductGalleryComponent {
  private modal = inject(ModalService);

  productInfo   = input.required<Product>();
  productForm   = input.required<FormGroup>();
  fieldsOptions = input<Fields | null>(null);

  /**
   * Max images per product — matches the old project (templates there gated
   * the Add button on `productMedia.length <= 4`, i.e. 5 total).
   */
  static readonly MAX_IMAGES = 5;

  /**
   * Source-of-truth for the gallery in THIS component. We keep a local
   * signal rather than reading `productInfo().productMedia` directly because
   * signals track reference identity — pushing to the inner array wouldn't
   * invalidate a computed that returned that array.
   *
   * We seed from `productInfo` on first render and mirror every write back
   * to it so the parent form's save path still sees the latest state.
   */
  media = signal<ProductMedia[]>([]);
  coverId = signal<string | null>(null);

  /** Main photo (first in the list), derived from `media`. */
  firstImage = computed<ProductMedia | null>(() => this.media()[0] ?? null);
  canAddMore = computed<boolean>(() => this.media().length < ProductGalleryComponent.MAX_IMAGES);

  constructor() {
    // Seed local state from productInfo after the input is bound.
    queueMicrotask(() => {
      const info = this.productInfo();
      this.media.set([...(info.productMedia ?? [])]);
      this.coverId.set(info.mediaId ?? info.productMedia?.[0]?.id ?? null);
    });
  }

  async openPicker(): Promise<void> {
    if (!this.canAddMore()) return;

    const info = this.productInfo();
    const existingIds = this.media().map((m) => m.id);
    const ref = this.modal.open<MediaPickerModalComponent, MediaPickerConfig, Media | Media[] | undefined>(
      MediaPickerModalComponent,
      {
        data: {
          contentTypes:   ['image'],
          multiple:       true,
          title:          'Add images',
          preSelectedIds: existingIds,
        },
        size: 'xl',
      },
    );
    const result = await ref.afterClosed();
    const picked = Array.isArray(result) ? result : (result ? [result] : []);
    if (!picked.length) return;

    // Merge picked items into local state, dedup by id, respect the 5-image cap.
    const next = [...this.media()];
    for (const p of picked as Media[]) {
      if (!p?.id || next.some((m) => m.id === p.id)) continue;
      if (next.length >= ProductGalleryComponent.MAX_IMAGES) break;
      next.push({
        id:           p.id ?? '',
        defaultUrl:   p.url?.defaultUrl ?? p.url?.original ?? '',
        thumbnailUrl: p.url?.thumbnail  ?? p.url?.defaultUrl ?? '',
      } as ProductMedia);
    }
    this.media.set(next);

    // First image in the list is the main / cover — always. Old project
    // semantics: `productMedia[0]` is main, index-0 is the cover.
    const firstId = next[0]?.id ?? null;
    if (firstId) this.coverId.set(firstId);

    this.syncToModel();
    this.productForm().markAsDirty();
  }

  /** Promote any image to the first position (becomes the main). */
  promoteToMain(id: string): void {
    const list = [...this.media()];
    const idx = list.findIndex((m) => m.id === id);
    if (idx <= 0) return; // already main or not found
    const [hit] = list.splice(idx, 1);
    list.unshift(hit);
    this.media.set(list);
    this.coverId.set(list[0].id);
    this.syncToModel();
    this.productForm().markAsDirty();
  }

  /**
   * Move a tile one slot earlier (towards position 0). Reads left-to-right,
   * top-to-bottom in the grid. Whatever ends up at index 0 becomes the new
   * main photo via `syncToModel`. Boundary-safe: calling on index 0 is a no-op.
   */
  moveLeft(id: string): void {
    this.swapWithOffset(id, -1);
  }

  /** Move a tile one slot later. No-op if already last. */
  moveRight(id: string): void {
    this.swapWithOffset(id, +1);
  }

  private swapWithOffset(id: string, offset: 1 | -1): void {
    const list = [...this.media()];
    const idx = list.findIndex((m) => m.id === id);
    const target = idx + offset;
    if (idx < 0 || target < 0 || target >= list.length) return;
    [list[idx], list[target]] = [list[target], list[idx]];
    this.media.set(list);
    this.coverId.set(list[0]?.id ?? null);
    this.syncToModel();
    this.productForm().markAsDirty();
  }

  removeAt(id: string): void {
    const next = this.media().filter((m) => m.id !== id);
    this.media.set(next);
    // First remaining image becomes the new main (mirrors old project).
    this.coverId.set(next[0]?.id ?? null);
    this.syncToModel();
    this.productForm().markAsDirty();
  }

  isMain(id: string): boolean {
    return this.firstImage()?.id === id;
  }

  // ── Sync local state → productInfo so the form's save path picks it up. ─
  private syncToModel(): void {
    const info = this.productInfo();
    info.productMedia = [...this.media()];
    const first = info.productMedia[0] ?? null;
    info.mediaId = first?.id ?? null;
    info.mediaUrl = first
      ? ({ id: first.id, defaultUrl: first.defaultUrl, thumbnailUrl: first.thumbnailUrl ?? first.defaultUrl } as any)
      : ({} as any);
  }
}
