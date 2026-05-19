import { Component, EventEmitter, Input, Output } from '@angular/core';
import {
  Coupon,
  DiscountSetCoupon,
  ProductsCouponSet,
  PromotionsCouponSet,
} from '../modal/promotion.modal';
import { translate } from '../modal/TranslatedString.modal';
import { AppServices } from 'src/app/services/appServices';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';

@Component({
  selector: 'app-coupon-card',
  imports: [CommonModule, TranslateModule],
  templateUrl: './coupon-card.component.html',
  styleUrl: './coupon-card.component.css',
})
export class CouponCardComponent {
  translate = translate;
  constructor(public appService: AppServices) { }
  @Input() coupon!: Coupon;

  @Output() select = new EventEmitter<any>();

  onSelect() {
    this.select.emit(this.coupon);
  }
  isDiscountSet(
    set: PromotionsCouponSet | undefined,
  ): set is DiscountSetCoupon {
    return !!set && 'percentage' in set && 'minimumOrder' in set;
  }
  isProductSet(set: PromotionsCouponSet | undefined): set is ProductsCouponSet {
    return !!set && 'products' in set;
  }

}
