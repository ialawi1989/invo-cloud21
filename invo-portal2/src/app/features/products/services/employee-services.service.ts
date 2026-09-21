import { Injectable, inject } from '@angular/core';
import { ApiService } from '@core/http';

export interface EmployeeServiceRow {
  productId: string;
  name: string;
  price: number;
  serviceTime: number;
}

/**
 * Employee-centric view of a service product's "Price per team": the services a
 * staff member performs, with their own price + duration for each. Verified
 * against the legacy `employee/getEmployeeServices` / `saveEmployeeServices`.
 */
@Injectable({ providedIn: 'root' })
export class EmployeeServicesService {
  private api = inject(ApiService);

  async get(employeeId: string): Promise<EmployeeServiceRow[]> {
    const data = await this.api.call<any>(this.api.get(`employee/getEmployeeServices/${employeeId}`));
    return (data?.services ?? []).map((s: any): EmployeeServiceRow => ({
      productId: s.productId,
      name: s.name,
      price: s.price ?? 0,
      serviceTime: s.serviceTime ?? 0,
    }));
  }

  /** Full replace - an empty list clears the employee's services. */
  async save(employeeId: string, services: EmployeeServiceRow[]): Promise<void> {
    await this.api.call(this.api.post('employee/saveEmployeeServices', {
      employeeId,
      services: services.map(s => ({
        productId: s.productId,
        price: Number(s.price) || 0,
        serviceTime: Number(s.serviceTime) || 0,
      })),
    }));
  }
}
