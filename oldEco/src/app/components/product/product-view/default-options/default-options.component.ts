import { Component, Input } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Product } from 'src/app/models/product.model';
import { AppServices } from 'src/app/services/appServices';

@Component({
  selector: 'app-default-options',
  imports: [FormsModule],
  templateUrl: './default-options.component.html',
  styleUrl: './default-options.component.css'
})
export class DefaultOptionsComponent {

  @Input() product !: Product;
  @Input() currentCurrency: any;

  constructor(
    public appService: AppServices,
  ) {

  }


  decreaseQty(option: any) {
    if (option.tempQty > 0) {
      option.tempQty--;
    }
  }

  increaseQty(option: any) {
    if (option.tempQty < option.qty) {
      option.tempQty++;
    }
  }





}
