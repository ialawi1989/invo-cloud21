import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, OnInit, Output, SimpleChanges, inject } from '@angular/core';
import { LoggerService } from 'src/app/services/logger/logger.service';
import { FormsModule } from '@angular/forms';
import { RedeemPromoComponent } from './redeem-promo/redeem-promo.component';
import { RedeemPointsComponent } from './redeem-points/redeem-points.component';
import { CompareService } from 'src/app/services/compare/compare.service';
import { WalletServiceService } from '../wallet-service/wallet-service.service';
import {
  Coupon,
  CouponProduct,
  CouponSetsSettings,
  CouponsSet,
  WalletSettings,
} from '../modal/promotion.modal';
import { TranslateModule } from '@ngx-translate/core';
import { CartService } from 'src/app/services/cartServices/cart.service';

@Component({
  selector: 'app-redeem',
  templateUrl: './redeem.component.html',
  styleUrls: ['./redeem.component.css'],
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RedeemPromoComponent,
    RedeemPointsComponent,
    TranslateModule,
  ],
})
export class RedeemComponent implements OnInit {
  private logger = inject(LoggerService);
  @Input() currency = '';
  @Input() branchId: string = '';
  @Input() serviceId: string = '';
  @Input() cartCouponId: string = '';
  walletSettings!: WalletSettings;
  couponsEnabled!: CouponSetsSettings;
  @Output() redeem = new EventEmitter<{
    promoCoupon: number;
    pointsDiscount: number;
    usedPoints: number;
    selectedOption: string;
    couponId?: string;
    product?: CouponProduct;
  }>();
  @Output() unRedeem = new EventEmitter<{
    selectedOption: string;
    couponId?: string;
    product?: CouponProduct;
  }>();
  selectedOption: string = 'Choose an option';
  message: string = '';
  messageType: 'success' | 'error' | '' = '';

  @Input() maxPoints = '';
  @Input() total = 0;
  showPoints: boolean = false;
  showCoupons: boolean = false;
  options = [
    { value: 'promo', label: 'PROMOTIONAL_CODE' },
    { value: 'points', label: 'POINTS' },
  ];

  constructor(
    private compareService: CompareService,
    public walletServiceService: WalletServiceService,
    public cartService: CartService,
  ) {}
  async ngOnInit() {
    try {
      if (this.compareService.isUserLoggedIn()) {
        this.walletSettings =
          await this.walletServiceService.getWalletSettings();
        this.showPoints =
          !!this.walletSettings?.pointsSettings?.enabled &&
          this.compareService.isUserLoggedIn();
      }

      this.couponsEnabled =
        await this.walletServiceService.getCouponSetsSettings();
      this.showCoupons = !!this.couponsEnabled?.enabled;
    } catch (error) {
      console.error('Error loading wallet settings:', error);
    }
  }
  async ngOnChanges(changes: SimpleChanges) {
    if (changes['cartCouponId']) {
      await this.ngOnInit();
    }
  }
  async hideOrShowPoints() {
    this.showPoints =
      this.walletSettings.pointsSettings!.enabled &&
      this.compareService.isUserLoggedIn();
  }
  async hideOrShowCoupons() {
    // this.walletSettings.pointSittings = await this.walletServiceService.getPointsSettings();
    this.showCoupons = this.couponsEnabled.enabled;
  }

  clearMsg(changeOption?: boolean) {
    this.message = '';
    this.messageType = '';
    if (changeOption) {
      this.redeem.emit({
        promoCoupon: 0,
        pointsDiscount: 0,
        usedPoints: 0,
        selectedOption: this.selectedOption,
        product: undefined,
      });
    }
  }

  onChildRedeem(result: {
    promoCoupon: number;
    pointsDiscount: number;
    usedPoints: number;
    message: string;
    couponId?: string;
    product?: CouponProduct;
    type: 'success' | 'error' | '';
  }) {
    this.message = result.message;
    this.messageType = result.type;

    this.redeem.emit({
      promoCoupon: result.promoCoupon,
      pointsDiscount: result.pointsDiscount,
      usedPoints: result.usedPoints,
      selectedOption: this.selectedOption,
      couponId: result.couponId,
      product: result.product,
    });

    let sessionId = localStorage.getItem('sessionId');
    if (result.couponId && sessionId) {
      this.cartService
        .redeemCartCoupon({
          couponId: result.couponId,
          sessionId,
        })
        .subscribe((res) => {
        });
    }
  }
  onChildUnRedeem(result: {
    message: string;
    couponId?: string;
    type: 'success' | 'error' | '';
  }) {
    this.message = result.message;
    this.messageType = result.type;

    this.unRedeem.emit({
      selectedOption: this.selectedOption,
      couponId: result.couponId,
    });

    let sessionId = localStorage.getItem('sessionId');
    if (result.couponId && sessionId) {
      this.cartService
        .unRedeemCartCoupon({
          couponId: result.couponId,
          sessionId,
        })
        .subscribe((res) => {
        });
    }
  }
}
