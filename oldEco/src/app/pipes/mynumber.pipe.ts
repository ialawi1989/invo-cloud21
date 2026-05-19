import { Pipe, PipeTransform } from '@angular/core';
import { CompanyServices } from '../services/companyServices/company.service';
import { SharedCompanyData } from '../shared/modules/shared-company-data';


@Pipe({
  name: 'mynumber'
})
export class MynumberPipe extends SharedCompanyData implements PipeTransform {

  constructor() {
    super();
    super.loadCompany()
  }

  addThousandSeparators(num: string) {
    // Convert the number to a string
    const numStr = num.toString();
    // Split the number into integer and fractional parts
    const [integerPart, fractionalPart] = numStr.split('.');
    // Add thousand separators to the integer part
    const formattedIntegerPart = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');

    // Combine the integer part with the fractional part (if it exists)
    return fractionalPart ? `${formattedIntegerPart}.${fractionalPart}` : formattedIntegerPart;
  }

  transform(val: any, args?: any): any {
    let value = +val;
    if (value == null) value = 0;


    if (args != null) {
      return value.toFixed(args);
    }

    if (this.companySettings != null) {

      const decimalPlaces = (value.toString().split('.')[1] || '').length;
      if (decimalPlaces >= 0 && decimalPlaces <= this.companySettings?.settings.afterDecimal|| decimalPlaces > 10) {
        return this.addThousandSeparators((value.toFixed(this.companySettings?.settings.afterDecimal)));
      } else {
        return this.addThousandSeparators(value.toString());
      }
    }

    return this.addThousandSeparators(value.toFixed(3));
  }

}
