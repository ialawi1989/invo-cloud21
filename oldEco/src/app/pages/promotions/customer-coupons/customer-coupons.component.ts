import { Component, OnInit } from '@angular/core';
import {
  Coupon,
  CouponSetsSettings,
  CouponStatues,
} from '../modal/promotion.modal';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { AppServices } from 'src/app/services/appServices';
import { AuthService } from 'src/app/services/authService/auth.service';
import { WalletServiceService } from '../wallet-service/wallet-service.service';
import { CouponCardComponent } from '../coupon-card/coupon-card.component';

export type CouponFilter = 'all' | 'available' | 'used';

@Component({
  selector: 'app-customer-coupons',
  templateUrl: './customer-coupons.component.html',
  styleUrl: './customer-coupons.component.css',
  imports: [CommonModule, TranslateModule, RouterModule, CouponCardComponent],
})
export class CustomerCouponsComponent implements OnInit {
  couponSetsSettings!: CouponSetsSettings;
  activeCouponsNumber: number = 0;
  isLoading: boolean = true;
  activeFilter: CouponFilter = 'all';

  constructor(
    public walletServiceService: WalletServiceService,
    private authService: AuthService,
    private router: Router,
    public appService: AppServices,
  ) {}

  coupons: Coupon[] = [];
  selectedCoupon: Coupon | null = null;

  get filteredCoupons(): Coupon[] {
    switch (this.activeFilter) {
      case 'available':
        return this.coupons.filter(c => c.status === CouponStatues.ACTIVE);
      case 'used':
        return this.coupons.filter(
          c => c.status === CouponStatues.USED ||
               c.status === CouponStatues.EXPIRED ||
               c.status === CouponStatues.CANCELED
        );
      default:
        return this.coupons;
    }
  }

  get usedCouponsNumber(): number {
    return this.coupons.filter(
      c => c.status === CouponStatues.USED ||
           c.status === CouponStatues.EXPIRED ||
           c.status === CouponStatues.CANCELED
    ).length;
  }

  setFilter(filter: CouponFilter) {
    this.activeFilter = filter;
  }

  async getCouponSet(couponSetId: string) {
    return await this.walletServiceService.getCouponSet(couponSetId);
  }

  async ngOnInit() {
    if (!this.authService.isCustomerAuthenticated()) {
      this.router.navigate(['/']);
      return;
    }

    this.isLoading = true;
    try {
      this.coupons = await this.walletServiceService.getCustomerCoupons(false, true);
      this.couponSetsSettings = await this.walletServiceService.getCouponSetsSettings();
      this.activeCouponsNumber = this.coupons.filter(
        (c) => c.status === CouponStatues.ACTIVE,
      ).length;
    } finally {
      this.isLoading = false;
    }
  }

  selectCoupon(coupon: Coupon) {
    this.selectedCoupon = coupon;
  }

  goBack() {
    window.history.back();
  }
}