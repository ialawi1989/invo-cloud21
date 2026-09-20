import { Injectable } from '@angular/core';
import { WaitlistPrefill } from '../models/appointment.types';

export interface AppointmentPrefillHandoff {
  waitlistId: string;
  prefill: WaitlistPrefill;
}

/**
 * One-shot in-memory handoff from Waitlist "Convert" to the appointment
 * form — the prefill payload has multiple lines with possibly-null times,
 * which doesn't survive round-tripping through query params cleanly.
 *
 * NOTE: legacy had this exact same service, but nothing ever called
 * `.take()` from the form's `ngOnInit` — the waitlist "Convert" flow never
 * actually prefilled anything there. This port wires it up for real: see
 * `AppointmentFormComponent.ngOnInit` and `WaitlistComponent.convert`.
 */
@Injectable({ providedIn: 'root' })
export class AppointmentPrefillService {
  private pending: AppointmentPrefillHandoff | null = null;

  set(handoff: AppointmentPrefillHandoff): void {
    this.pending = handoff;
  }

  /** Consumes the stashed handoff — returns `null` if none is pending (e.g. a page refresh). */
  take(): AppointmentPrefillHandoff | null {
    const v = this.pending;
    this.pending = null;
    return v;
  }
}
