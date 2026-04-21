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
import {
  MediaPickerModalComponent,
  MediaPickerConfig,
} from '../../../../../media/components/media-picker/media-picker-modal.component';
import type { Media } from '../../../../../media/models/media.model';

import { Product, ProductImage as ProductImageModel } from '../../../../models/product-form.model';
import { Fields } from '../../../../models/product-fields.model';

/**
 * product-image
 * ─────────────
 * Cover-image card. Opens the project's MediaPickerModal to select an
 * existing image or upload a new one; writes the result onto
 * `productInfo.mediaId` + `productInfo.mediaUrl` and marks the parent
 * form dirty. No FormGroup is registered — the media id isn't meaningful
 * as a pure value control in this project's shared components; the parent
 * form owns dirty tracking via `markAsDirty()`.
 */
@Component({
  selector: 'app-pf-product-image',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, TranslateModule],
  templateUrl: './product-image.component.html',
  styleUrl: './product-image.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProductImageComponent implements OnInit {
  private modal = inject(ModalService);

  productInfo   = input.required<Product>();
  productForm   = input.required<FormGroup>();
  fieldsOptions = input<Fields | null>(null);

  // Re-render trigger — signal we bump after a picker selection so the
  // template reads the freshly-updated productInfo.mediaUrl.
  private version = signal(0);

  currentUrl = computed<string>(() => {
    void this.version();
    return this.productInfo().mediaUrl?.defaultUrl ?? '';
  });

  hasImage = computed<boolean>(() => !!this.currentUrl());

  ngOnInit(): void {
    // Nothing to register on the FormGroup — image selection is dirty-tracked
    // via productForm.markAsDirty() below.
  }

  async openPicker(): Promise<void> {
    const config: MediaPickerConfig = {
      contentTypes: ['image'],
      multiple: false,
      title: 'Choose product image',
    };
    const ref = this.modal.open<MediaPickerModalComponent, MediaPickerConfig, Media | Media[] | undefined>(
      MediaPickerModalComponent,
      { data: config, size: 'xl' },
    );
    const result = await ref.afterClosed();
    const picked = Array.isArray(result) ? result[0] : result;
    if (!picked) return;

    const info = this.productInfo();
    const img = new ProductImageModel();
    img.id           = picked.id ?? '';
    img.defaultUrl   = picked.url?.defaultUrl ?? picked.url?.original ?? '';
    img.thumbnailUrl = picked.url?.thumbnail ?? img.defaultUrl;
    info.mediaId  = picked.id ?? null;
    info.mediaUrl = img;
    this.productForm().markAsDirty();
    this.version.update((n) => n + 1);
  }

  removeImage(): void {
    const info = this.productInfo();
    info.mediaId = null;
    info.mediaUrl = new ProductImageModel();
    this.productForm().markAsDirty();
    this.version.update((n) => n + 1);
  }
}
