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

  private version = signal<number>(0);

  media = computed<ProductMedia[]>(() => {
    void this.version();
    return this.productInfo().productMedia ?? [];
  });

  coverId = computed<string | null>(() => {
    void this.version();
    return this.productInfo().mediaId;
  });

  async openPicker(): Promise<void> {
    const info = this.productInfo();
    const existingIds = (info.productMedia ?? []).map((m) => m.id);
    const ref = this.modal.open<MediaPickerModalComponent, MediaPickerConfig, Media | Media[] | undefined>(
      MediaPickerModalComponent,
      {
        data: {
          contentTypes:  ['image'],
          multiple:      true,
          title:         'Add images',
          preSelectedIds: existingIds,
        },
        size: 'xl',
      },
    );
    const result = await ref.afterClosed();
    const picked = Array.isArray(result) ? result : (result ? [result] : []);
    if (!picked.length) return;

    if (!Array.isArray(info.productMedia)) info.productMedia = [];
    picked.forEach((p: Media) => {
      if (!p?.id) return;
      if (info.productMedia.some((m) => m.id === p.id)) return;
      info.productMedia.push({
        id:           p.id ?? '',
        defaultUrl:   p.url?.defaultUrl ?? p.url?.original ?? '',
        thumbnailUrl: p.url?.thumbnail  ?? p.url?.defaultUrl ?? '',
      } as ProductMedia);
    });
    // Adopt first image as cover if nothing picked yet.
    if (!info.mediaId && info.productMedia.length) {
      this.setCover(info.productMedia[0].id, /* silent */ true);
    }
    this.productForm().markAsDirty();
    this.version.update((n) => n + 1);
  }

  setCover(id: string, silent = false): void {
    const info = this.productInfo();
    const hit = info.productMedia.find((m) => m.id === id);
    if (!hit) return;
    info.mediaId = hit.id;
    info.mediaUrl = {
      id:           hit.id,
      defaultUrl:   hit.defaultUrl,
      thumbnailUrl: hit.thumbnailUrl ?? hit.defaultUrl,
    } as any;
    if (!silent) {
      this.productForm().markAsDirty();
      this.version.update((n) => n + 1);
    }
  }

  removeAt(id: string): void {
    const info = this.productInfo();
    info.productMedia = info.productMedia.filter((m) => m.id !== id);
    if (info.mediaId === id) {
      const nextCover = info.productMedia[0];
      info.mediaId = nextCover?.id ?? null;
      info.mediaUrl = nextCover
        ? ({ id: nextCover.id, defaultUrl: nextCover.defaultUrl, thumbnailUrl: nextCover.thumbnailUrl } as any)
        : ({} as any);
    }
    this.productForm().markAsDirty();
    this.version.update((n) => n + 1);
  }

  isCover(id: string): boolean {
    return this.coverId() === id;
  }
}
