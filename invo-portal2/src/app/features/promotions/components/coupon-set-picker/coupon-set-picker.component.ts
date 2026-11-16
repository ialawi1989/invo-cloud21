import { ChangeDetectionStrategy, Component, inject, input, output } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';

import { LanguageService } from '@core/i18n/language.service';
import { SearchDropdownComponent } from '@shared/components/dropdown/search-dropdown.component';

import { CouponSetsStatues, CouponsSet } from '../../models/coupons.model';
import { CouponsService } from '../../services/coupons.service';

/**
 * Async coupon-set search for the campaign forms — the legacy
 * `invo-coupon-select-select-textbox`: first 10 sets matching the text, consumed
 * ones dropped, and either only stamp-card sets (`stampCard`) or everything but.
 * The label is "name - status", falling back to the English name.
 */
@Component({
  selector: 'app-coupon-set-picker',
  standalone: true,
  imports: [SearchDropdownComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-search-dropdown
      [loadFn]="load"
      [pageSize]="10"
      [displayWith]="display"
      [compareWith]="compare"
      [clearable]="false"
      [searchable]="true"
      [value]="value() ?? null"
      (valueChange)="valueChange.emit($any($event) ?? undefined)"/>
  `,
})
export class CouponSetPickerComponent {
  private service = inject(CouponsService);
  private lang = inject(LanguageService);
  private translateService = inject(TranslateService);

  value = input<CouponsSet | null | undefined>(null);
  stampCard = input(false);
  valueChange = output<CouponsSet | undefined>();

  load = async (params: { page: number; pageSize: number; search: string }) => {
    const info = { page: 1, limit: 10, count: 1, startIndex: 0, lastIndex: 9 };
    const sets = (await this.service.getCouponSets(info, undefined, undefined, false, params.search)) ?? [];
    const stamp = this.stampCard();
    const items = sets.filter(
      c => c.status !== CouponSetsStatues.CONSUMED && (stamp ? c.type === 'STAMP_CARDS' : c.type !== 'STAMP_CARDS'),
    ) as CouponsSet[];
    return { items, hasMore: false };
  };

  display = (c: CouponsSet) => {
    if (!c) return '';
    const l = this.lang.current() || 'en';
    const name = c.name?.[l] ? c.name[l] : c.name?.['en'];
    return `${name} - ${this.translateService.instant('PROMOTIONS.COUPONS.COUPON_STATUS.' + c.status)}`;
  };
  compare = (a: CouponsSet, b: CouponsSet) => a?.id === b?.id;
}
