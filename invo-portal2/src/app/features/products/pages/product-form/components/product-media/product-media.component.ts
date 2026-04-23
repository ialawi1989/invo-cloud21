import {
  ChangeDetectionStrategy,
  Component,
  input,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormGroup } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';

import { Product } from '../../../../models/product-form.model';
import { Fields } from '../../../../models/product-fields.model';

import { ProductGalleryComponent } from '../product-gallery/product-gallery.component';
import { Product3dModelComponent } from '../product-3dmodel/product-3dmodel.component';

type MediaTab = 'images' | 'model';

/**
 * ProductMediaCardComponent
 * ─────────────────────────
 * Single tabbed card that houses the product's Image Gallery and 3D Model
 * pickers — mirrors the old project's `<product-image>` wrapper (one card,
 * two tabs) instead of the two separate cards we had before. Each tab's
 * content is the existing gallery / 3d-model component; the switcher above
 * just toggles which one is active.
 */
@Component({
  selector: 'app-pf-product-media',
  standalone: true,
  imports: [
    CommonModule,
    TranslateModule,
    ProductGalleryComponent,
    Product3dModelComponent,
  ],
  templateUrl: './product-media.component.html',
  styleUrl: './product-media.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProductMediaCardComponent {
  productInfo   = input.required<Product>();
  productForm   = input.required<FormGroup>();
  fieldsOptions = input<Fields | null>(null);

  /** Active tab — Images (default) | 3D Model. */
  readonly activeTab = signal<MediaTab>('images');

  setTab(tab: MediaTab): void {
    this.activeTab.set(tab);
  }
}
