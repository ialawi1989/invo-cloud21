import { CommonModule } from "@angular/common";
import { importProvidersFrom, NgModule } from "@angular/core";
import { CarouselModule } from "ngx-owl-carousel-o";
import { ProductViewComponent } from "../../components/product/product-view/product-view.component";
import { ProductComponent } from "./product.component";
import { ProductGridComponent } from "../../components/product/product-grid/product-grid.component";
import { RouterLink, RouterModule, Routes } from "@angular/router";
import { TranslateModule } from "@ngx-translate/core";
import { BranchStatusAlertComponent } from "../../components/branch-status-alert/branch-status-alert.component";

const routes: Routes = [
  {
    path: '',
    component: ProductComponent
  }
];

@NgModule({
  declarations: [
    ProductComponent
  ],
  imports: [
    CarouselModule,
    CommonModule,
    ProductViewComponent,
    ProductGridComponent,
    TranslateModule,
    BranchStatusAlertComponent,
    RouterLink
  ],
  providers: [
    importProvidersFrom(RouterModule.forChild(routes))
  ],
  bootstrap: [],
  exports: [ProductComponent]
})

export class ProductComponentModule {
}
