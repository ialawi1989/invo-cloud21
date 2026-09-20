import { Injectable, inject } from '@angular/core';
import { ApiService } from '@core/http';
import { WaitlistEntry, WaitlistPrefill } from '../models/appointment.types';

/**
 * Wraps `appointments/waitlist/*`. Verified: `convert` only RETURNS a
 * prefill payload — it does not create the booking or change the entry's
 * status. The caller must chain: convert → open the appointment form
 * pre-filled → on save, call `setStatus(id, 'booked')`. (Legacy's frontend
 * never did this chaining — `AppointmentPrefillService.take()` was dead
 * code, so "Convert" never actually booked anything there.)
 */
@Injectable({ providedIn: 'root' })
export class WaitlistService {
  private api = inject(ApiService);

  /** `status` defaults server-side to 'pending' when omitted — this returns the pending queue. */
  async getWaitlist(): Promise<WaitlistEntry[]> {
    return this.api.call<WaitlistEntry[]>(this.api.post('appointments/waitlist/list', {})).catch(() => []);
  }

  async convert(id: string): Promise<WaitlistPrefill> {
    return this.api.call<WaitlistPrefill>(this.api.post('appointments/waitlist/convert', { id }));
  }

  async setStatus(id: string, status: 'pending' | 'booked' | 'cancelled'): Promise<void> {
    await this.api.call(this.api.post('appointments/waitlist/setStatus', { id, status }));
  }
}
