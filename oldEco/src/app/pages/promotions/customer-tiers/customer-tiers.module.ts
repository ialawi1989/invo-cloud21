import { importProvidersFrom, NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { CustomerTiersComponent } from './customer-tiers.component';
import { TierProgressComponent } from '../tier-progress/tier-progress.component';
import { TierBenefitsComponent } from '../tier-benefits/tier-benefits.component';
import { TranslateModule } from '@ngx-translate/core';
import { CommonModule } from '@angular/common';



@NgModule({
  imports: [CommonModule, TranslateModule],
  providers: [],
   
})
export class CustomerTiersComponentModule {}
