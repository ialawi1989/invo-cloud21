import { Component, inject, OnInit } from '@angular/core';
import { Company } from 'src/app/models/company.model';
import { CompanyServices } from 'src/app/services/companyServices/company.service';
import { LoggerService } from 'src/app/services/logger/logger.service';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';


@Component({
  selector: 'app-shared',
  template: ''
})
export abstract class SharedCompanyData implements OnInit {
  protected destroy$ = new Subject<void>();
  companySettings!: Company;
  public companyService!: CompanyServices;
  protected logger!: LoggerService;
  constructor() {
    this.companyService = inject(CompanyServices);
    this.logger = inject(LoggerService);
  }

  async ngOnInit() {
    this.loadCompany();
  }

  loadCompany() {
    this.companyService.companyData$.pipe(takeUntil(this.destroy$)).subscribe({
      next: (responseData: Company) => {
        this.companySettings = responseData;
        CompanyServices.companySettings = this.companySettings;
      },
    });
  }



  protected getPosition(): Promise<number[]> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation not supported'));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve([position.coords.latitude, position.coords.longitude]);
      },
      (error) => {
        // Don't log as error for denied permissions - it's expected user behavior
        if (error.code === 1) {
        } else {
          this.logger.error(error?.message, { context: 'SharedCompanyData.getPosition', code: error?.code });
        }
        reject({ err: 'denied', code: error.code });
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 300000
      }
    );
  });
}

  /******************************/
  /******* Helper methods *******/
  /******************************/

  // lat1 , lon1 ==> for branch location
  // lat2, lon2 ==> for current location
  getDistanceFromLatLonInKm(lat1: any, lon1: any, lat2: any, lon2: any) {
    var R = 6371; // Radius of the earth in km
    var dLat = this.deg2rad(lat2 - lat1);  // deg2rad below
    var dLon = this.deg2rad(lon2 - lon1);
    var a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.deg2rad(lat1)) * Math.cos(this.deg2rad(lat2)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2)
      ;
    var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    var d = R * c; // Distance in km
    return d;
  }

  deg2rad(deg: any) {
    return deg * (Math.PI / 180)
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
