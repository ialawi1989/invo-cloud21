import { NgModule } from "@angular/core";
import { HeaderComponent } from "./header.component";
import { HeaderStyle1Component } from "./header-style1/header-style1.component";
import { CommonModule } from "@angular/common";
import { RouterModule } from "@angular/router";
import { FormsModule } from "@angular/forms";
import { NgbModalModule } from "@ng-bootstrap/ng-bootstrap";
import { TranslateModule } from "@ngx-translate/core";
import { WalletHeaderComponent } from "src/app/pages/promotions/wallet-header/wallet-header.component";
import { HeaderStyle2Component } from "./header-style2/header-style2.component";


@NgModule({
  // tslint:disable-next-line: max-line-length
  declarations: [
    HeaderComponent,
    HeaderStyle1Component,
    HeaderStyle2Component,
    WalletHeaderComponent
  ],
  imports: [
    CommonModule,
    RouterModule,
    FormsModule,
    NgbModalModule,
    TranslateModule,
],
  providers: [],
  exports: [HeaderComponent]
})
export class HeaderModule { }
