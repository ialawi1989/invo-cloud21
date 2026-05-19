import { RouterModule, Routes } from '@angular/router';

import { AuthGuard } from 'src/app/core/guards/auth.guard';
import { WalletComponent } from './wallet/wallet.component';
import { PointsStatementComponent } from './points-statement/points-statement.component';
import { NgModule } from '@angular/core';
import { CustomerTiersComponent } from './customer-tiers/customer-tiers.component';
import { CommonModule } from '@angular/common';

export const routes: Routes = [
  {
    path: 'wallet2',
    loadChildren: () =>
      import('./wallet/wallet.module').then((m) => m.WalletComponentModule),
  },
  { path: 'wallet', component: WalletComponent, canActivate: [AuthGuard] },
  { path: 'points-statement', component: PointsStatementComponent },
  { path: 'customer-tiers', component: CustomerTiersComponent },
];
@NgModule({
  declarations: [],
  imports: [RouterModule.forChild(routes), CommonModule],
  providers: [],
})
export class PromotionsModule {}
