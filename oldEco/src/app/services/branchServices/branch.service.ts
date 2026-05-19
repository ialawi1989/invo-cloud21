import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { Branch } from '../../models/branch.model';
import { AppConfigService } from '../app-config.service';
import { DeliveryAddresses } from '../../models/delivery-address.model';
import { AppServices } from '../appServices';
import { LoggerService } from '../logger/logger.service';

@Injectable({
  providedIn: 'root'
})
export class BranchService {
  private logger = inject(LoggerService);

  constructor(private http: HttpClient, private config: AppConfigService , private appService: AppServices) { }

  // Get the list of branches
  getBranchList(): Observable<Branch[] | null> {
    const url = `${this.config.baseUrl}branch/getBranchList`;

    return this.http.get<any>(url, { headers: this.appService.getHeaders() }).pipe(
      map(response => {
        if (response.success && response.data) {
          return response.data.map((branchData: any) => { const _inst = new Branch(); _inst.ParseJson(branchData); return _inst; });
        }
        return null;
      }),
      catchError(error => {
        this.logger.error(error, { context: 'BranchService.getBranchList' });
        throw new Error('Failed to load branches');
      })
    );
  }

  // Get covered addresses for a specific branch
  getBranchCoveredAddresses(branchId: string): Observable<DeliveryAddresses | null> {
    const url = `${this.config.baseUrl}branch/getBranchCoveredAddresses/${branchId}`;

    return this.http.get<any>(url, { headers: this.appService.getHeaders() }).pipe(
      map(response => {
        if (response.success && response.data) {
          // return DeliveryAddresses.fromMap(response.data);
          return response.data;
        }
        return null;
      }),
      catchError(error => {
        this.logger.error(error, { context: 'BranchService.getBranchCoveredAddresses' });
        throw new Error('Failed to load getBranchCoveredAddresses');
      })
    );
  }
}
