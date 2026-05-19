import { Component, Input } from '@angular/core';
import {
  CustomerTier,
  PromotionsCampaign,
  SpendXGetYPointsCampaign,
} from '../modal/promotion.modal';
import { CommonModule } from '@angular/common';
import { translate } from '../modal/TranslatedString.modal';
import { AppServices } from 'src/app/services/appServices';
import { WalletServiceService } from '../wallet-service/wallet-service.service';
import { TranslateModule } from '@ngx-translate/core';

@Component({
  selector: 'app-tier-benefits',
  templateUrl: './tier-benefits.component.html',
  styleUrl: './tier-benefits.component.css',
  standalone: true,
  imports: [CommonModule, TranslateModule],

})
export class TierBenefitsComponent {
  @Input() tiers: CustomerTier[] = [];
  @Input() currentIndex: number = 0;
  @Input() unlockedIndices: number[] = [];
  allCampaigns: any[] = [];
  translate = translate;
  displayedTier!: CustomerTier;
  isCurrent: boolean = true;
  isUnlocked: boolean = false;
  campaign!: any[];
  constructor(
    public appService: AppServices,
    public walletServiceService: WalletServiceService
  ) {}
  async ngOnInit() {
    this.showTier(this.currentIndex);
    this.allCampaigns = await this.walletServiceService.getPointCampaigns();
    for (let tier of this.tiers) {
      this.campaign = this.allCampaigns.filter((c) =>
        c.customerTierIds?.includes(tier.id)
      );
    }
  }

  mapCampaignsToTiers() {
    if (!this.tiers || !this.allCampaigns) return;
  }
  showTier(index: number) {
    this.displayedTier = this.tiers[index];
    this.isCurrent = index === this.currentIndex;
    this.isUnlocked = this.unlockedIndices.includes(index);
  }
}
