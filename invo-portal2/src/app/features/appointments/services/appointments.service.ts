import { Injectable, inject } from '@angular/core';
import { ApiService } from '@core/http';
import {
  AppointmentPayload,
  AppointmentTask,
  EmployeeAppointments,
} from '../models/appointment.types';

/**
 * Wraps `appointments/*` (InvoCloudBack `src/routes/v1/app/appointments.ts`).
 * Verified against backend source, `feature/new-project`:
 *
 * - There is NO dedicated Appointments table. `getAppointments` is a UNION
 *   over Estimates/EstimateLines (booked, not yet invoiced) and
 *   Invoices/InvoiceLines (checked in). An "appointment" IS an Estimate
 *   that becomes an Invoice on check-in — `saveAppointment` calls
 *   `EstimateRepo.addEstimate/editEstimate`; `checkIn` reuses the invoice
 *   pipeline (`InvoiceController.addInvoice`) directly.
 * - `serviceId` (top-level, optional on the payload) is NOT the bookable
 *   item — it's the company's business-service-type row (e.g. the "Salon"
 *   row from Settings → Service Management). The server resolves the
 *   company's default Salon service automatically when omitted, so this
 *   client never sends it.
 * - The bookable item is `AppointmentLine.productId` — a Product with
 *   `type === 'service'` (name, `serviceTime` minutes, `defaultPrice`,
 *   `employeePrices[]`).
 * - `cancelAppointment` / `rejectOnlineAppointment` / `rejectAcceptedAppointment`
 *   are three route names for the exact same backend handler — it only
 *   ever sets `Estimates.onlineData.onlineStatus = 'Rejected'`, which
 *   `getAppointments`'s WHERE clause excludes. That only works on the
 *   Estimate side (booked, not yet invoiced) — there is no equivalent for
 *   an already-invoiced (checked-in) appointment, so Cancel is disabled
 *   once `isInvoiced` is true rather than silently doing nothing.
 */
@Injectable({ providedIn: 'root' })
export class AppointmentsService {
  private api = inject(ApiService);

  async getAppointments(input: { from: Date | string; to: Date | string; employeeIds?: string[] }): Promise<AppointmentTask[]> {
    return this.api.call<AppointmentTask[]>(
      this.api.post('appointments/getAppointments', {
        from: toIso(input.from),
        to: toIso(input.to),
        employeeIds: input.employeeIds ?? [],
      }),
    ).catch(() => []);
  }

  async getAppointment(id: string, isInvoiced: boolean): Promise<AppointmentPayload | null> {
    return this.api.call<AppointmentPayload | null>(
      this.api.post('appointments/getAppointment', { id, isInvoiced }),
    ).catch(() => null);
  }

  async saveAppointment(payload: AppointmentPayload): Promise<{ id?: string }> {
    return this.api.call(this.api.post('appointments/saveAppointment', payload));
  }

  async checkIn(payload: AppointmentPayload): Promise<{ id?: string }> {
    return this.api.call(this.api.post('appointments/checkIn', payload));
  }

  async updateAppointmentTask(input: { taskId: string; employeeId: string; dateTime: string; isInvoiced: boolean }): Promise<void> {
    await this.api.call(this.api.post('appointments/updateAppointmentTask', input));
  }

  /**
   * Changes one line's duration by re-saving the whole appointment.
   * There's no lightweight endpoint for this — `updateAppointmentTask` only
   * ever writes `serviceDate`/`salesEmployeeId` (verified against
   * `AppointmentRepo.updateAppointmentTask`, InvoCloudBack), so resizing an
   * appointment card goes through the same get → mutate → `saveAppointment`
   * path the form uses. Booked (Estimate) appointments only — `saveAppointment`
   * always writes through `EstimateRepo`, so there is no equivalent for an
   * already-invoiced task; callers must not offer resize once `isInvoiced`.
   */
  async resizeTask(appointmentId: string, taskId: string, newDuration: number): Promise<boolean> {
    const raw = await this.getAppointment(appointmentId, false);
    const line = raw?.lines?.find(l => l.id === taskId);
    if (!raw || !line) return false;

    line.serviceDuration = newDuration;
    try {
      await this.saveAppointment(raw);
      return true;
    } catch {
      return false;
    }
  }

  /** Cancel a booked (not yet invoiced) appointment. Callers must not offer this once `isInvoiced` is true. */
  async cancelAppointment(id: string, reason?: string): Promise<void> {
    await this.api.call(this.api.post('appointments/cancelAppointment', { id, reason }));
  }

  async loadEmployeeSchedule(input: { employeeId: string; date: Date | string }): Promise<EmployeeAppointments | null> {
    return this.api.call<EmployeeAppointments | null>(
      this.api.post('appointments/loadEmployeeSchedule', { ...input, date: toIso(input.date) }),
    ).catch(() => null);
  }

  async printEmployeeSchedule(input: { employeeId: string; date: Date | string }): Promise<EmployeeAppointments | null> {
    return this.api.call<EmployeeAppointments | null>(
      this.api.post('appointments/printEmployeeSchedule', { ...input, date: toIso(input.date) }),
    ).catch(() => null);
  }
}

function toIso(v: Date | string): string {
  return v instanceof Date ? v.toISOString() : v;
}
