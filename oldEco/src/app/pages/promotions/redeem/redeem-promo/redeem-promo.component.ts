import { CommonModule } from '@angular/common';
import {
  Component,
  EventEmitter,
  input,
  Input,
  Output,
  SimpleChanges,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AppServices } from 'src/app/services/appServices';
import { AuthService } from 'src/app/services/authService/auth.service';
import {
  Coupon,
  CouponProduct,
  CouponsSet,
  CouponStatues,
  DiscountSetCoupon,
  ProductsCouponSet,
  PromotionsCouponSet,
} from '../../modal/promotion.modal';
import { WalletServiceService } from '../../wallet-service/wallet-service.service';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { translate } from '../../modal/TranslatedString.modal';

@Component({
  selector: 'app-redeem-promo',
  templateUrl: './redeem-promo.component.html',
  styleUrls: ['./redeem-promo.component.css'],
  imports: [CommonModule, FormsModule, TranslateModule],
})
export class RedeemPromoComponent {
  @Input() currency: string = '';
  @Input() total: number = 0;
  @Input() branchId: string = '';
  @Input() serviceId: string = '';
  @Input() cartCouponId?: string;
  @Output() redeem = new EventEmitter<{
    promoCoupon: number;
    pointsDiscount: number;
    usedPoints: number;
    message: string;
    type: 'success' | 'error';
    couponId?: string;
    product?: CouponProduct;
  }>();
  @Output() unRedeem = new EventEmitter<{
    message: string;
    type: 'success' | 'error';
    couponId?: string;
  }>();
  appliedCouponId: string | null = null;
  promoCode: string = '';
  translate = translate;
  redeemPromo() {
    const code = this.promoCode.trim();
    if (!code) return;

    const coupon = this.coupons.find((c) => c.code === code);

    if (!coupon) {
      this.redeem.emit({
        promoCoupon: 0,
        pointsDiscount: 0,
        usedPoints: 0,
        message: this.translate2.instant('PROMOTIONS.PROMO.INVALID_CODE'),
        type: 'error',
      });
      return;
    }

    if (coupon.status !== CouponStatues.ACTIVE) {
      this.redeem.emit({
        promoCoupon: 0,
        pointsDiscount: 0,
        usedPoints: 0,
        message: this.translate2.instant('PROMOTIONS.PROMO.NOT_ACTIVE'),
        type: 'error',
      });
      return;
    }

    if (this.isDiscountSet(coupon.couponSet)) {
      if (coupon.couponSet.minimumOrder > this.total) {
        this.redeem.emit({
          promoCoupon: 0,
          pointsDiscount: 0,
          usedPoints: 0,
          message: this.translate2.instant('PROMOTIONS.PROMO.MIN_ORDER', {
            amount: coupon.couponSet.minimumOrder,
            currency: this.currency,
          }),
          type: 'error',
        });
        return;
      }

      const discount = coupon.couponSet.percentage || 0;

      this.redeem.emit({
        promoCoupon: discount,
        pointsDiscount: 0,
        usedPoints: 0,
        message: this.translate2.instant('PROMOTIONS.PROMO.SUCCESS', {
          discount: discount,
        }),
        type: 'success',
        couponId: coupon.id,
      });
      this.appliedCouponId = coupon.id;
    } else if (this.isProductSet(coupon.couponSet)) {
      const product = coupon.couponSet.products;

      if (!product) return;

      const name = product.productsInfo?.name
        ? translate(product.productsInfo.name, this.appService.lang)
        : 'Unknown Product';

      let productMessage = '';

      if (product.percentage === 100) {
        productMessage = this.translate2.instant('PROMOTIONS.PRODUCT_FREE', {
          name,
        });
      } else {
        productMessage = this.translate2.instant(
          'PROMOTIONS.PRODUCT_WITH_PERCENTAGE',
          {
            name,
            percentage: product.percentage,
          },
        );
      }

      this.redeem.emit({
        promoCoupon: 0,
        pointsDiscount: 0,
        usedPoints: 0,
        message: this.translate2.instant('PROMOTIONS.PROMO.SUCCESS_PRODUCT', {
          products: productMessage,
        }),
        type: 'success',
        couponId: coupon.id,
        product: product,
      });
      this.appliedCouponId = coupon.id;
    }
  }
  async unRedeemPromo() {
    const code = this.promoCode.trim();
    if (!code) return;
    const coupon = await this.walletServiceService.getCoupon(this.cartCouponId);

    if (!coupon) {
      this.unRedeem.emit({
        message: this.translate2.instant('PROMOTIONS.PROMO.INVALID_CODE'),
        type: 'error',
      });
      return;
    }
    this.unRedeem.emit({
      message: this.translate2.instant('PROMOTIONS.PROMO.SUCCESS_UNREDEEMED'),
      type: 'success',
      couponId: coupon.id,
    });
    this.appliedCouponId = '';
    this.promoCode = '';
  }

  constructor(
    public walletServiceService: WalletServiceService,
    private authService: AuthService,
    public appService: AppServices,
    public translate2: TranslateService,
  ) {}

  coupons: Coupon[] = [];
  coupon?: Coupon;
  couponSet?: CouponsSet;

  async ngOnInit() {
    await this.loadCoupons();
    if (this.cartCouponId) {
      this.coupon = await this.walletServiceService.getCoupon(
        this.cartCouponId,
      );
      if (this.coupon.couponSetId)
        this.couponSet = await this.walletServiceService.getCouponSet(
          this.coupon.couponSetId,
        );
      this.promoCode = this.coupon.code;
      this.appliedCouponId = this.coupon.id;
    }
  }
  async reLode() {
    await this.loadCoupons();
    if (!this.cartCouponId) {
      this.appliedCouponId = null;
      this.promoCode = '';
      this.redeem.emit({
        promoCoupon: 0,
        pointsDiscount: 0,
        usedPoints: 0,
        message: this.translate2.instant('PROMOTIONS.PROMO.INVALID_CODE'),
        type: 'error',
        couponId: undefined,
      });
    }
  }
  async ngOnChanges(changes: SimpleChanges) {
    if (changes['branchId'] && !changes['branchId'].firstChange) {
      await this.loadCoupons();
    }

    if (changes['serviceId'] && !changes['serviceId'].firstChange) {
      await this.loadCoupons();
    }

    if (changes['total'] && !changes['total'].firstChange) {
      await this.loadCoupons();
    }
    if (changes['cartCouponId'] && !changes['cartCouponId'].firstChange) {
      await this.reLode();
    }
  }

  async loadCoupons() {
    if (!this.branchId) return;
    if (!this.serviceId) return;
    this.coupons = await this.walletServiceService.getCustomerCoupons(
      true,
      false,
      true,
      this.branchId,
      this.serviceId,
      true,
    );
  }

  isDiscountSet(
    set: PromotionsCouponSet | undefined,
  ): set is DiscountSetCoupon {
    return !!set && 'percentage' in set && 'minimumOrder' in set;
  }
  isProductSet(set: PromotionsCouponSet | undefined): set is ProductsCouponSet {
    return !!set && 'products' in set;
  }
  onSelectCoupon(event: Event) {
    const value = (event.target as HTMLSelectElement).value;
    if (value) {
      this.promoCode = value;
    }
  }
}
