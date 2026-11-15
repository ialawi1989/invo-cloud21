import { Injectable, inject } from '@angular/core';
import { ApiService } from '@core/http';

export interface EmployeeServiceRow {
  productId: string;
  name: string;
  price: number;
  serviceTime: number;
}

/**
 * Employee-centric view of a service product's "Price per team", split in two independent halves (as legacy):
 *  - capability: WHICH services the employee performs (`getEmployeeServicesCapability` / `setEmployeeServicesPricing`)
 *  - pricing:    the employee's OWN price + duration per service (`getEmployeePricing` / `setEmployeePricing`)
 * Verified against InvoCloudBack `routes/v1/app/employee.ts` + `employeeService.repo.ts`.
 */
@Injectable({ providedIn: 'root' })
export class EmployeeServicesService {
  private api = inject(ApiService);

  /** Ids of the services the employee performs. */
  async getCapability(employeeId: string): Promise<string[]> {
    const data = await this.api.call<any>(this.api.get(`employee/getEmployeeServicesCapability/${employeeId}`));
    const list = Array.isArray(data) ? data : data?.serviceIds || data?.services || [];
    return list.map((x: any) => (typeof x === 'string' ? x : x.productId ?? x.serviceId ?? x.id));
  }

  /** Full replace of the services the employee performs. */
  async setCapability(employeeId: string, serviceIds: string[]): Promise<void> {
    await this.api.call(this.api.post('employee/setEmployeeServicesPricing', { employeeId, serviceIds }));
  }

  /** The employee's own price + duration per service. */
  async getPricing(employeeId: string): Promise<EmployeeServiceRow[]> {
    const data = await this.api.call<any>(this.api.get(`employee/getEmployeePricing/${employeeId}`));
    const list: any[] = Array.isArray(data) ? data : data?.services ?? [];
    return list.map((s): EmployeeServiceRow => ({
      productId: s.productId,
      name: s.name,
      price: s.price ?? 0,
      serviceTime: s.serviceTime ?? 0,
    }));
  }

  /** Upsert (body is an array, one entry per employee + service). Rows removed from the list are not deleted server-side. */
  async setPricing(employeeId: string, services: EmployeeServiceRow[]): Promise<void> {
    await this.api.call(this.api.post('employee/setEmployeePricing', services.map(s => ({
      employeeId,
      productId: s.productId,
      price: Number(s.price) || 0,
      serviceTime: Number(s.serviceTime) || 0,
    }))));
  }
}
