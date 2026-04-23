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

import { Product, ProductImage as ProductImageModel } from '../../../../models/product-form.model';
import { Fields } from '../../../../models/product-fields.model';

/** 3D model (GLB / USDZ / etc.) picker card — identical flow to product-image. */
@Component({
  selector: 'app-pf-product-3dmodel',
  standalone: true,
  imports: [CommonModule, TranslateModule],
  templateUrl: './product-3dmodel.component.html',
  styleUrl: './product-3dmodel.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Product3dModelComponent {
  private modal = inject(ModalService);

  productInfo   = input.required<Product>();
  productForm   = input.required<FormGroup>();
  fieldsOptions = input<Fields | null>(null);

  /**
   * Local state — see `ProductGalleryComponent` for the rationale. Seeding
   * from `productInfo` in a microtask ensures we pick up the async-loaded
   * product data; we then mirror every write back to `productInfo` via
   * `syncToModel`.
   */
  current = signal<ProductImageModel | null>(null);

  hasModel  = computed<boolean>(() => !!this.current());
  currentUrl = computed<string>(() => this.current()?.defaultUrl ?? '');
  modelName  = computed<string>(() => this.current()?.name ?? '');

  constructor() {
    queueMicrotask(() => {
      const info = this.productInfo();
      this.current.set(info.threeDModel?.id ? info.threeDModel : null);
    });
  }

  async openPicker(): Promise<void> {
    const ref = this.modal.open<MediaPickerModalComponent, MediaPickerConfig, Media | Media[] | undefined>(
      MediaPickerModalComponent,
      {
        data: { contentTypes: ['model', '3d'], multiple: false, title: 'Choose 3D model' },
        size: 'xl',
      },
    );
    const result = await ref.afterClosed();
    const picked = Array.isArray(result) ? result[0] : result;
    if (!picked) return;

    const m = new ProductImageModel();
    m.id           = picked.id ?? '';
    m.defaultUrl   = picked.url?.defaultUrl ?? picked.url?.original ?? '';
    m.thumbnailUrl = picked.url?.thumbnail ?? m.defaultUrl;
    m.name         = picked.name;

    this.current.set(m);
    this.syncToModel();
    this.productForm().markAsDirty();
  }

  removeModel(): void {
    this.current.set(null);
    this.syncToModel();
    this.productForm().markAsDirty();
  }

  private syncToModel(): void {
    const info = this.productInfo();
    const m = this.current();
    info.threeDModel   = m;
    info.threeDModelId = m?.id ?? '';
  }
}
