import { Injectable, inject } from '@angular/core';
import { ApiService } from '@core/http';
import { ServiceCapabilityRow } from '../models/appointment.types';

/**
 * Wraps `appointments/capability/*` — which staff can perform which
 * bookable service. Verified real (not a stub): `EmployeeServiceCapability`
 * table, seeded empty on purpose — empty/no rows for a service means every
 * employee can perform it; adding rows switches that service to an
 * allow-list. `matrix` and the per-employee GET are real GET endpoints;
 * the two save calls are POST full-replace.
 */
@Injectable({ providedIn: 'root' })
export class ServiceCapabilityService {
  private api = inject(ApiService);

  async getMatrix(): Promise<ServiceCapabilityRow[]> {
    return this.api.call<ServiceCapabilityRow[]>(this.api.get('appointments/capability/matrix')).catch(() => []);
  }

  /** Full replace — send the complete checked set; empty array resets the service to "any staff". */
  async saveServiceCapability(serviceId: string, employeeIds: string[]): Promise<void> {
    await this.api.call(this.api.post('appointments/capability/service', { serviceId, employeeIds }));
  }
}
