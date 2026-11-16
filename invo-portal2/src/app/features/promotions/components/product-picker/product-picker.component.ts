import { ChangeDetectionStrategy, Component, inject, input, output } from '@angular/core';

import { LanguageService } from '@core/i18n/language.service';
import { SearchDropdownComponent } from '@shared/components/dropdown/search-dropdown.component';

import { translate } from '../../models/common.model';
import { ProductInfo } from '../../models/coupons.model';
import { PromotionsLookupsService } from '../../services/promotions-lookups.service';

/**
 * Async product search (5 per page) — the legacy `invo-products-select-textbox`.
 * `excluded` hides products already chosen elsewhere in the same form.
 */
@Component({
  selector: 'app-promo-product-picker',
  standalone: true,
  imports: [SearchDropdownComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-search-dropdown
      [loadFn]="load"
      [pageSize]="5"
      [displayWith]="display"
      [compareWith]="compare"
      [clearable]="true"
      [searchable]="true"
      [placeholder]="placeholder()"
      [value]="value() ?? null"
      (valueChange)="valueChange.emit($any($event) ?? undefined)"/>
  `,
})
export class PromoProductPickerComponent {
  private lookups = inject(PromotionsLookupsService);
  private lang = inject(LanguageService);

  value = input<ProductInfo | null | undefined>(null);
  excluded = input<ProductInfo[]>([]);
  placeholder = input<string>('');
  valueChange = output<ProductInfo | undefined>();

  load = async (params: { page: number; pageSize: number; search: string }) => {
    const items = await this.lookups.getProducts(params.search, {
      page: 1, limit: 5, count: 1, startIndex: 0, lastIndex: 4,
    });
    const ex = new Set((this.excluded() ?? []).map(p => p?.id));
    return { items: (items ?? []).filter(p => !ex.has(p.id)), hasMore: false };
  };

  display = (p: ProductInfo) => (p?.name ? translate(p.name, this.lang.current() || 'en') : '');
  compare = (a: ProductInfo, b: ProductInfo) => a?.id === b?.id;
}
