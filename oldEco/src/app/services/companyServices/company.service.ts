import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable } from 'rxjs';
import { map } from 'rxjs/operators';

import { AppConfigService } from '../app-config.service';
import { Company } from '../../models/company.model';
import { ThemeSettings } from '../../models/theme-settings.model';
import { CompanyDeliveryAddress } from '../../models/company-delivery-address.model';
import { MenuSettings } from '../../models/menu-settings.model';
import { AppServices } from '../appServices';
import { MobileIconBarSettings } from 'src/app/models/mobile-bar-settings.model';

@Injectable({
  providedIn: 'root',
})
export class CompanyServices {
  static companySettings: Company;
  constructor(private http: HttpClient, private config: AppConfigService, private appService: AppServices) { }

  private companyData = new BehaviorSubject<Company>(new Company());
  companyData$ = this.companyData.asObservable();
  // Method to set cart data
  setCompanyData(data: Company): void {
    this.companyData.next(data);
  }
  getCompanyPreferences(): Observable<Company | null> {
    // FIX: Guard against calls that arrive before initializeApp() has resolved.
    // If the config is not yet initialized the subdomain hasn't been appended,
    // so baseUrl is still './v1/ecommerce/' with no company segment. Firing the
    // request in that state produces the backend "Company Not Found" error
    // (4526 events). Return an empty observable instead of making a bad request.
    if (!this.config.isInitialized) {
      console.warn('[CompanyServices] baseUrl not yet initialized — skipping getCompanyPreferences call.');
      return new Observable(observer => {
        observer.next(null);
        observer.complete();
      });
    }

    return this.http
      .get<{ success: boolean; data: any }>(`${this.config.baseUrl}getCompanyPrefrences`, { headers: this.appService.getHeaders() })
      .pipe(
        map(response => {
          if (response.success && response.data) {
            const data = response.data;
            // Parse theme settings
            const themeSettings = new ThemeSettings(); themeSettings.ParseJson(data.themeSettings || {});
            const menuSettings = new MenuSettings().ParseJson(data.menuSettings || {})
            const mobileIconBar = new MobileIconBarSettings().ParseJson(data.mobileIconBar || {})
            const oldThemeSettings = data.oldThemeSettings;
            // Parse company data with theme settings
            const company = new Company();
            company.ParseJson({
              ...data.company,
              themeSettings: themeSettings.toMap(),
              menuSettings: menuSettings.toMap(),
              mobileIconBar: mobileIconBar.toMap(),
              oldThemeSettings: oldThemeSettings
            });
            return company;
          }
          return null;
        })
      );
  }


  getCompanyDeliveryAddresses(): Observable<CompanyDeliveryAddress | any> {
    return this.http
      .get<{ success: boolean; data: any }>(
        `${this.config.baseUrl}getCompanyDeliveryAddresses`,
        { headers: this.appService.getHeaders() }
      )
      .pipe(
        map(response => {
          if (response.success && response.data) {

            const _inst = new CompanyDeliveryAddress(); _inst.ParseJson(response.data); return _inst;
          } else {
            return null;
          }
        })
      );
  }

}