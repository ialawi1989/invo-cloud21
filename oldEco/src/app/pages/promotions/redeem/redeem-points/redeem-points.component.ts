import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { WalletServiceService } from '../../wallet-service/wallet-service.service';
import {
  CustomerWallet,
  PointsSettings,
  WalletSettings,
} from '../../modal/promotion.modal';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

@Component({
  selector: 'app-redeem-points',
  templateUrl: './redeem-points.component.html',
  styleUrls: ['./redeem-points.component.css'],
  standalone: true,
  imports: [CommonModule, FormsModule, TranslateModule],
})
export class RedeemPointsComponent implements OnInit {
  @Input() currency: string = '';
  @Input() maxPoints: string = '';
  @Output() redeem = new EventEmitter<{
    promoCoupon: number;
    pointsDiscount: number;
    usedPoints: number;
    message: string;
    type: 'success' | 'error' | '';
  }>();

  pointValue: number = 0.1;
  redeemPointsAmount: number | null = null;

  loading: boolean = true;
  userWallet: CustomerWallet | null = null; // FIX: was `userWallet!: CustomerWallet` (non-null assertion)
  walletSettings!: WalletSettings;

  constructor(public walletServiceService: WalletServiceService, private translate: TranslateService) {}

  ngOnInit() {
    this.getUserPoints();
  }

  async getUserPoints() {
    this.userWallet = await this.walletServiceService.getCustomerWallet();
    this.walletSettings = await this.walletServiceService.getWalletSettings();
    this.loading = false;
  }

  get totalPointsWorth(): string {
    // FIX: guard against null userWallet or missing pointsSettings
    if (!this.userWallet || !this.walletSettings?.pointsSettings) return '0.00';
    return (
      this.userWallet.balancePoints *
      (this.walletSettings.pointsSettings.currencyValue /
        this.walletSettings.pointsSettings.pointsValue)
    ).toFixed(2);
  }

  get equivalentAmount(): string {
    if (!this.redeemPointsAmount || this.redeemPointsAmount <= 0) return '0.00';
    // FIX: guard against missing pointsSettings
    if (!this.walletSettings?.pointsSettings) return '0.00';
    return (
      this.redeemPointsAmount *
      (this.walletSettings.pointsSettings.currencyValue /
        this.walletSettings.pointsSettings.pointsValue)
    ).toFixed(2);
  }

  onPointsChange() {
    if (this.redeemPointsAmount == null) {
      this.redeem.emit({
        promoCoupon: 0,
        pointsDiscount: 0,
        usedPoints: 0,
        message: this.translate.instant('PROMOTIONS.POINTS_ERRORS.ENTER_POINTS'),
        type: 'error',
      });
      return;
    }

    if (this.redeemPointsAmount <= 0) {
      this.redeem.emit({
        promoCoupon: 0,
        pointsDiscount: 0,
        usedPoints: 0,
        message: this.translate.instant('PROMOTIONS.POINTS_ERRORS.INVALID_POINTS'),
        type: 'error',
      });
      return;
    }

    // FIX: guard against null userWallet before accessing balancePoints
    if (!this.userWallet) {
      this.redeem.emit({
        promoCoupon: 0,
        pointsDiscount: 0,
        usedPoints: 0,
        message: this.translate.instant('PROMOTIONS.POINTS_ERRORS.NO_WALLET'),
        type: 'error',
      });
      return;
    }

    if (this.redeemPointsAmount > this.userWallet.balancePoints) {
      this.redeem.emit({
        promoCoupon: 0,
        pointsDiscount: 0,
        usedPoints: this.redeemPointsAmount,
        message: this.translate.instant('PROMOTIONS.POINTS_ERRORS.EXCEED_BALANCE'),
        type: 'error',
      });
      return;
    }

    if (Number(this.equivalentAmount) > Number(this.maxPoints)) {
      this.redeem.emit({
        promoCoupon: 0,
        pointsDiscount: 0,
        usedPoints: this.redeemPointsAmount,
        message: this.translate.instant('PROMOTIONS.POINTS_ERRORS.EXCEED_BILL', {
          amount: this.equivalentAmount,
          currency: this.currency,
          bill: parseFloat(this.maxPoints),
        }),
        type: 'error',
      });
      return;
    }

    const amount = +(
      this.redeemPointsAmount *
      (this.walletSettings.pointsSettings!.currencyValue /
        this.walletSettings.pointsSettings!.pointsValue)
    ).toFixed(2);

    this.redeem.emit({
      promoCoupon: 0,
      pointsDiscount: amount,
      usedPoints: this.redeemPointsAmount,
      message: '',
      type: '',
    });
  }
}