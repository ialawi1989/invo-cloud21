import { Component } from '@angular/core';
import { TierProgressComponent } from '../tier-progress/tier-progress.component';
import { TierBenefitsComponent } from '../tier-benefits/tier-benefits.component';
import {
  CustomerTier,
  CustomerTierSettings,
  CustomerWallet,
  PromotionsCampaign,
} from '../modal/promotion.modal';
import { AppServices } from 'src/app/services/appServices';
import { AuthService } from 'src/app/services/authService/auth.service';
import { WalletServiceService } from '../wallet-service/wallet-service.service';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { CustomerTierDetailsComponent } from "../customer-tier-details/customer-tier-details.component";

@Component({
  selector: 'app-customer-tiers',
  templateUrl: './customer-tiers.component.html',
  styleUrl: './customer-tiers.component.css',
  standalone:true,
  imports: [CommonModule, TranslateModule, RouterModule, 
    //TierProgressComponent, 
    TierBenefitsComponent, CustomerTierDetailsComponent],
})
export class CustomerTiersComponent {
  allCampaigns: PromotionsCampaign[] = [];
  promotionsService: any;
  userWallet: CustomerWallet | undefined;  
  currentIndex: number=0;
  unlockedIndices : number[]=[];
  constructor(
    public walletServiceService: WalletServiceService,
    private authService: AuthService,
    public appService: AppServices
  ) {}
  tiers!: CustomerTierSettings;
  async ngOnInit() {
    this.userWallet = await this.walletServiceService.getCustomerWallet();
    this.tiers = await this.walletServiceService.getCustomerTierSettings();
    this.allCampaigns = await this.walletServiceService.getPointCampaigns();
    if(this.tiers)
    this.mapCampaignsToTiers();
    this.currentIndex = await this.walletServiceService.getCustomerTierIndex(this.userWallet!.customerTierId);
     this.unlockedIndices = this.tiers.customerTiers
      .map((_, index) => index)
      .filter((i) => i <= this.currentIndex);

   
  }

  mapCampaignsToTiers() {
    if (!this.tiers?.customerTiers || !this.allCampaigns) return;
    
    if(this.tiers.customerTiers)
    for (let tier of this.tiers.customerTiers) {
      tier.campaign = this.allCampaigns.filter((c) =>
        c.customerTierIds?.includes(tier.id)
      );
    }
  }

    goBack() {
    window.history.back();
  }


}
