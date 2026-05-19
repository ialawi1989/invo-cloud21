import { Component, Input } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';
import { Company } from 'src/app/models/company.model';
import { Product } from 'src/app/models/product.model';

@Component({
  selector: 'app-product-price',
  imports: [TranslateModule],
  templateUrl: './product-price.component.html',
  styleUrl: './product-price.component.css'
})
export class ProductPriceComponent {
  @Input() currentCurrency: any = {};
  @Input() product: Product = new Product();
  @Input() companyData: Company = new Company();
}
