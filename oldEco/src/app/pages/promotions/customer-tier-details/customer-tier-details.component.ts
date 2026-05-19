import { Component, inject, OnDestroy} from '@angular/core';
import { LoggerService } from 'src/app/services/logger/logger.service';
import { CustomerTier, CustomerWallet, PeriodUnit, WalletSettings } from '../modal/promotion.modal';
import { Router } from '@angular/router';
import { AppServices } from 'src/app/services/appServices';
import { AuthService } from 'src/app/services/authService/auth.service';
import { WalletServiceService } from '../wallet-service/wallet-service.service';
import { translate } from '../modal/TranslatedString.modal';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { Shopper } from 'src/app/models/shopper.module';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

@Component({
  selector: 'app-customer-tier-details',
    imports: [CommonModule, TranslateModule],
  templateUrl: './customer-tier-details.component.html',
  styleUrl: './customer-tier-details.component.css',
})
export class CustomerTierDetailsComponent implements OnDestroy {
  private destroy$ = new Subject<void>();
  private logger = inject(LoggerService);
  TierIndex: number=0;

  constructor(
    public walletServiceService: WalletServiceService,
    private authService: AuthService,
    private router: Router,
    public appService: AppServices
  ) {}
  translate = translate;

  walletSettings!: WalletSettings;
  tier: CustomerTier | undefined;
  progressPosition: string = '0%';
  conditionsType!: string;
  tireExpiryDate!: Date;
  nextTier: CustomerTier | undefined;
  numberOfRemanOrder!: number;
  amountOfRemanSpend!: number;
  userData!: Shopper;
  userWallet: CustomerWallet | undefined;

    async ngOnInit() {
    this.authService.userData$.pipe(takeUntil(this.destroy$)).subscribe({
      next: (data: any) => {
        this.userData = data;
      },
    });
    this.walletSettings = await this.walletServiceService.getWalletSettings();
    this.userWallet = await this.walletServiceService.getCustomerWallet();



    if (this.walletSettings.customerTiersSettings?.enabled) {
      this.tier = await this.walletServiceService.getCustomerTier(
        this.userWallet!.customerTierId
      );
        this.TierIndex = await this.walletServiceService.getCustomerTierIndex(
        this.userWallet!.customerTierId
      );

      if (!this.tier) {
        this.logger.error('Tier not found for customer', { context: 'CustomerTierDetailsComponent.ngOnInit.tier' });
        return;
      }

      this.nextTier = await this.walletServiceService.getNextTire(this.tier.id);
      if (!this.nextTier) {
        this.logger.error('Next tier not found for customer', { context: 'CustomerTierDetailsComponent.ngOnInit.nextTier' });
        return;
      }
      this.numberOfRemanOrder =
        this.nextTier.minNumberOfOrders - this.userWallet!.numberOfOrders;
      if (this.numberOfRemanOrder < 0) this.numberOfRemanOrder = 0;

      this.amountOfRemanSpend =
        this.nextTier.minAmountSpend - this.userWallet!.amountSpend;
      if (this.amountOfRemanSpend < 0) this.amountOfRemanSpend = 0;

      this.conditionsType =
        this.walletSettings.customerTiersSettings!.conditionMatch ==
        'ALL_CONDITION'
          ? 'and'
          : 'or';
      this.tireExpiryDate = this.calculateExpiryDate(
        this.userWallet!.latestOrderDate !== null? this.userWallet!.latestOrderDate : new Date(),
        this.walletSettings.customerTiersSettings!.calculationPeriod,
        this.walletSettings.customerTiersSettings!.calculationPeriodUnit
      );

      const tiers = this.walletSettings.customerTiersSettings!.customerTiers;
      const currentTierIndex = tiers.findIndex((t) => t.id === this.tier!.id);
      const totalTiers = tiers.length;

      if (totalTiers > 1 && currentTierIndex >= 0) {
        const percentage = (currentTierIndex / (totalTiers - 1)) * 100;
        this.progressPosition = `${percentage}%`;
      }
    }
  }
    private calculateExpiryDate(
      baseDate: Date,
      period: number,
      unit: PeriodUnit
    ): Date {
      const date = new Date(baseDate);
      switch (unit) {
        case PeriodUnit.DAYS:
          date.setDate(date.getDate() + period);
          break;
        case PeriodUnit.WEEKS:
          date.setDate(date.getDate() + period * 7);
          break;
        case PeriodUnit.MONTHS:
          date.setMonth(date.getMonth() + period);
          break;
        case PeriodUnit.YEARS:
          date.setFullYear(date.getFullYear() + period);
          break;
      }
      return date;
    }


  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
