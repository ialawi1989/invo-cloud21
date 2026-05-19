// src/app/components/product/product-list/product-list-style1/product-list-style1.component.ts

import { Component, Input } from '@angular/core';
import { Product } from '../../../../models/product.model';
import { Company } from '../../../../models/company.model';
import { TranslateModule } from '@ngx-translate/core';
import { AppServices } from 'src/app/services/appServices';
import { LazyImageComponent } from '../../../lazy-image/lazy-image.component';
import { ProductUtilityService } from 'src/app/services/productUtilityService/product-utility.service';
import { ProductPriceComponent } from '../../product-price/product-price.component';

@Component({
  selector: 'app-product-list-style1',
  imports: [ProductPriceComponent, TranslateModule, LazyImageComponent],
  templateUrl: './product-list-style1.component.html',
  styleUrl: './product-list-style1.component.css',
})
export class ProductListStyle1Component {

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

  // Delegate commonly used properties/methods to productUtility
  get isBrowser() { return this.productUtility.isBrowser; }
  get currentCurrency() { return this.productUtility.currentCurrency; }

  addItemToCart(param: any) { return this.productUtility.addItemToCart(param); }
  isInWishList(productId: string) { return this.productUtility.isInWishList(productId); }
  addItemToWishlist(product: Product) { this.productUtility.addItemToWishlist(product); }
  get selectedProduct() { return this.productUtility.selectedProduct; }

}
