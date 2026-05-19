import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { Product } from 'src/app/models/product.model';

@Component({
  selector: 'app-measurements-options',
  imports: [
    TranslateModule,
    FormsModule,
    CommonModule
  ],
  templateUrl: './measurements-options.component.html',
  styleUrl: './measurements-options.component.css'
})
export class MeasurementsOptionsComponent {

  @Input() product !: Product;
  measurementOption = 'cm';

  trackByFn(index: number, item: any): number {
    return index; // or use a unique identifier from item
  }

  onTypeChange(type:any){
    this.product.measurementsArray.forEach((m:any)=>{
      m.type=type;
    })
  }

}
