import { ChangeDetectorRef, Pipe, PipeTransform } from "@angular/core";
import { Company } from "../models/company.model";
import { SharedCompanyData } from "../shared/modules/shared-company-data";

@Pipe({
  name: "mycurrency",
  pure: false
})
export class MycurrencyPipe extends SharedCompanyData implements PipeTransform {
  companySettings!: Company;

  constructor() {
    super();
    super.loadCompany()
  }

  transform(val: any, args?: any): any {

    let value = +val;

    if (value == null || isNaN(value)) value = 0;



    if (args?.symbol == null) {
      if (this.companySettings != null) {
        let format = ""

        format = this.companySettings?.settings.currencySymbol + " " +
          value.toFixed(this.companySettings?.settings.afterDecimal).replace(/\B(?=(\d{3})+(?!\d))/g, ",")

        return (format
        );
      }
      return value.toFixed(3).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    } else {
      return (args?.symbol + " " +
        value.toFixed(args?.afterDecimal).replace(/\B(?=(\d{3})+(?!\d))/g, ",")
      );

    }

  }
}
