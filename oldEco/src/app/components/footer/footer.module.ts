import { NgModule } from "@angular/core";
import { FooterStyle1Component } from "./footer-style1/footer-style1.component";
import { FooterComponent } from "./footer.component";
import { RouterModule } from "@angular/router";
import { TranslateModule } from "@ngx-translate/core";

@NgModule({
  // tslint:disable-next-line: max-line-length
  declarations: [
    FooterComponent,
    FooterStyle1Component
  ],
  imports: [
    RouterModule,
    TranslateModule
  ],
  providers: [],
  exports:[FooterComponent]
})
export class FooterModule { }
