import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';

import { ProductInfo } from '../../models/coupons.model';
import { PromoProductPickerComponent } from '../product-picker/product-picker.component';

/**
 * A list of product pickers ("this OR that"), each removable, plus an add
 * button — the legacy `app-product-selector-list-component`. Emits the whole
 * new list on every change (empty slots are kept so the user can fill them).
 */
@Component({
  selector: 'app-product-selector-list',
  standalone: true,
  imports: [TranslateModule, PromoProductPickerComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="psl">
      @for (item of items(); track $index; let i = $index) {
        <div class="psl__row">
          <app-promo-product-picker class="psl__picker"
            [value]="item?.id ? item : null" [excluded]="items()" (valueChange)="set(i, $event)"/>
          @if (items().length > 1) {
            <button type="button" class="psl__rm" (click)="remove(i)" aria-label="remove">&times;</button>
          }
        </div>
      }
      <button type="button" class="psl__add" (click)="add()">
        + {{ 'PROMOTIONS.CAMPAIGNS.ADD_PRODUCT' | translate }}
      </button>
    </div>
  `,
  styles: [`
    .psl { display: flex; flex-direction: column; gap: 8px; }
    .psl__row { display: flex; gap: 8px; align-items: center; }
    .psl__picker { flex: 1; min-width: 0; }
    .psl__rm {
      width: 32px; height: 32px; border-radius: 8px; border: 1px solid #fecaca; background: #fff;
      color: #dc2626; font-size: 18px; line-height: 1; cursor: pointer;
    }
    .psl__add {
      align-self: flex-start; padding: 7px 14px; border-radius: 8px; border: 1px dashed #94a3b8;
      background: #fff; color: #2691a4; font-size: 13px; font-weight: 600; cursor: pointer;
    }
  `],
})
export class ProductSelectorListComponent {
  items = input<ProductInfo[]>([]);
  itemsChange = output<ProductInfo[]>();

  set(index: number, product: ProductInfo | undefined): void {
    const next = [...(this.items() ?? [])];
    next[index] = (product ?? {}) as ProductInfo;
    this.itemsChange.emit(next);
  }
  add(): void {
    this.itemsChange.emit([...(this.items() ?? []), {} as ProductInfo]);
  }
  remove(index: number): void {
    this.itemsChange.emit((this.items() ?? []).filter((_, i) => i !== index));
  }
}
