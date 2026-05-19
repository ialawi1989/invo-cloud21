import { importProvidersFrom, NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { WalletComponent } from './wallet.component';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { CarouselModule } from 'ngx-owl-carousel-o';
import { QRCodeComponent } from 'angularx-qrcode';
const routes: Routes = [{ path: '', component: WalletComponent }];

@NgModule({
  imports: [
    CarouselModule,
    CommonModule,
    TranslateModule,
    QRCodeComponent,
    WalletComponent,
  ],
  providers: [importProvidersFrom(RouterModule.forChild(routes))],
})
export class WalletComponentModule {}
