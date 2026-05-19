// src/app/components/product/product-grid/product-grid-style5/product-grid-style5.component.ts

import { Component, Input } from '@angular/core';
import { Company } from '../../../../models/company.model';
import { Product } from '../../../../models/product.model';
import { TranslateModule } from '@ngx-translate/core';
import { AppServices } from 'src/app/services/appServices';
import { LazyImageComponent } from '../../../lazy-image/lazy-image.component';
import { ProductUtilityService } from 'src/app/services/productUtilityService/product-utility.service';
import { ProductPriceComponent } from '../../product-price/product-price.component';

@Component({
  selector: 'app-product-grid-style5',
  imports: [TranslateModule, LazyImageComponent, ProductPriceComponent],
  templateUrl: './product-grid-style5.component.html',
  styleUrl: './product-grid-style5.component.css',
})
export class ProductGridStyle5Component {

  @Input() template: any;
  @Input() product: Product = new Product();
  @Input() companyData: Company = new Company();
  @Input() currentParent: String = '';
  @Input() slug: any = null;
  @Input() sectionId: string = '';
  @Input() gotoProductPage!: (product: Product) => void;

  constructor(
    public appService: AppServices,
    public productUtility: ProductUtilityService,
  ) {}

  get isBrowser()       { return this.productUtility.isBrowser; }
  get currentCurrency() { return this.productUtility.currentCurrency; }

  addItemToCart(param: any)           { return this.productUtility.addItemToCart(param); }
  isInWishList(productId: string)     { return this.productUtility.isInWishList(productId); }
  addItemToWishlist(product: Product) { this.productUtility.addItemToWishlist(product); }
  get selectedProduct() { return this.productUtility.selectedProduct; }

}
