import { Injectable } from '@angular/core';
import { BehaviorSubject, Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { CompanyServices } from '../companyServices/company.service';
import { Company } from '../../models/company.model';

@Injectable({
  providedIn: 'root'
})
export class CurrencyService {
  private destroy$ = new Subject<void>();
  constructor( private companyService: CompanyServices) {
    this.getCompanyData()
  }

  companyData: Company = new Company();

  private currencySource = new BehaviorSubject<any>({
    afterDecimal: this.companyData.settings['afterDecimal'],
    rate: 1,
    symbol: this.companyData.settings['currencySymbol'],
  });

  currentCurrency = this.currencySource.asObservable();

  changeCurrency(newCurrency: any) {
    this.currencySource.next(newCurrency);
  }

   getCompanyData() {
      this.companyService.companyData$.pipe(takeUntil(this.destroy$)).subscribe({
        next: (responseData: Company) => {
          this.companyData = responseData;
          this.currencySource.next({
            afterDecimal: this.companyData.settings['afterDecimal'],
            rate: 1,
            symbol: this.companyData.settings['currencySymbol'],
          });
        },
      });
    }
}
