import { Component, Input, Output, EventEmitter, Inject, PLATFORM_ID, OnDestroy} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CurrencyService } from '../../services/currencyService/currency.service';
import { isPlatformBrowser } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

@Component({
  selector: 'app-price-filter',
  imports: [
    FormsModule,
    TranslateModule
  ],
  templateUrl: './price-filter.component.html',
  styleUrls: ['./price-filter.component.css']
})
export class PriceFilterComponent implements OnDestroy {
  private destroy$ = new Subject<void>();

  
  @Input() minPrice: number = 0;
  @Input() maxPrice: number = 1000;  // Update maxPrice here

  @Output() minPriceChange = new EventEmitter<number>();
  @Output() maxPriceChange = new EventEmitter<number>();
  

  fillWidth: string = '0px';
  fillPosition: string = '0px';

  currentCurrency: any = {};
  isBrowser: boolean;

  viewStyle = 'line';

  constructor(
    private currencyService: CurrencyService,
    @Inject(PLATFORM_ID) private platformId: any,
  ) {
    this.isBrowser = isPlatformBrowser(this.platformId);
    
  }

  ngOnInit(): void {
    this.updateFill();
    this.currencyService.currentCurrency.pipe(takeUntil(this.destroy$)).subscribe((currency) => {
      this.currentCurrency = currency;
    });
    if (this.isBrowser) {
      const savedCurrency = localStorage.getItem('selectedCurrency');

      if (savedCurrency) {
        const currency = JSON.parse(savedCurrency);
        this.currentCurrency = currency;
      }
    }
  }

  updateFill() {
    const trackWidth = 100; // Assuming the track is 100% width
    const fillWidthPercentage = ((this.maxPrice - this.minPrice) / 1000) * trackWidth; // Change 100 to 1000
    const fillPositionPercentage = (this.minPrice / 1000) * trackWidth; // Change 100 to 1000
    this.fillWidth = `${fillWidthPercentage}%`;
    this.fillPosition = `${fillPositionPercentage}%`;
  }

  onMinPriceChange(value: number) {
    if (value >= this.maxPrice) {
      this.maxPrice = value;
    }
    this.minPrice = value;
    this.minPriceChange.emit(this.minPrice);
    this.updateFill();
  }

  onMaxPriceChange(value: number) {
    if (value <= this.minPrice) {
      this.minPrice = value;
    }
    this.maxPrice = value;
    this.maxPriceChange.emit(this.maxPrice);
    this.updateFill();
  }


  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}