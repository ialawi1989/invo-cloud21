import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common'; // <- مهم
import { TierBenefitsComponent } from './tier-benefits.component';
import { Routes } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';

const routes: Routes = [{ path: ''}];
@NgModule({

  imports: [
    CommonModule,
    TranslateModule
  ],
 
})
export class TierBenefitsModule { }
