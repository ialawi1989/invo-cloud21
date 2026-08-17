import { Injectable, inject } from '@angular/core';

import { ApiService } from '@core/http/api.service';
import {
  HolidayCalendar,
  HolidayCalendarAvailability,
  HolidayDay,
} from './holiday-calendar.types';

/**
 * Holiday calendars.
 *
 * **CORRECTED 2026-08-17.** This header said "against endpoints that DO NOT
 * EXIST YET". They exist as of `InvoCloudBack faec0e074`, and they implement
 * the contract this file already called. The degradation below is kept — a
 * deployment that has not migrated yet must still open the screen without an
 * error page — but it is no longer the expected case.
 *
 * ── HOW IT DEGRADES, AND WHY THAT IS THE POINT ───────────────────────────────
 * Every call answers rather than throws. A missing endpoint produces
 * `{ available: false }` and an empty list, so the screen can say "the server
 * does not offer this yet" instead of showing an empty calendar that looks like
 * a company with no public holidays.
 *
 * Those two states are indistinguishable to a user and mean opposite things:
 * one is "nothing is configured", the other is "this feature is not deployed".
 * Confusing them is how someone concludes their holidays were deleted.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Nothing here touches leave requests. See holiday-calendar.types.ts for why a
 * stored request's `days` must never be recomputed.
 */
@Injectable({ providedIn: 'root' })
export class HolidayCalendarService {
  private api = inject(ApiService);

  /** Cached only for the life of the page — availability is a deploy fact. */
  private availability: HolidayCalendarAvailability | null = null;

  lastAvailability(): HolidayCalendarAvailability {
    return this.availability ?? { available: true, reason: null };
  }

  /**
   * Every calendar for the company.
   *
   * Returns `[]` for both "none configured" and "endpoint absent" — the caller
   * distinguishes them with `lastAvailability()`, which is why that is not
   * folded into the array.
   */
  async list(): Promise<HolidayCalendar[]> {
    try {
      const res = await this.api.request<any>(this.api.get('employee/holidayCalendars'));
      if (res?.success === false) {
        this.availability = { available: false, reason: res?.msg ?? null };
        return [];
      }
      this.availability = { available: true, reason: null };
      const raw = Array.isArray(res?.data) ? res.data : (res?.data?.list ?? []);
      return (Array.isArray(raw) ? raw : []).map(mapCalendar);
    } catch (e: any) {
      // A 404 is the expected answer today. Anything else is also "cannot use
      // it", and the message is kept so the screen can show what was said
      // rather than a generic apology.
      this.availability = { available: false, reason: e?.message ?? null };
      return [];
    }
  }

  async save(calendar: Partial<HolidayCalendar>): Promise<{ id: string } | null> {
    try {
      const res = await this.api.request<any>(
        this.api.post('employee/saveHolidayCalendar', calendar as any),
      );
      if (res?.success === false) throw new Error(res?.msg || 'Could not save the calendar');
      return { id: res?.data?.id ?? String(calendar.id ?? '') };
    } catch (e: any) {
      // Save failures are NOT swallowed — an unsaved calendar the user believes
      // is saved is worse than an error. Only reads degrade.
      throw e;
    }
  }

  async remove(calendarId: string): Promise<void> {
    const res = await this.api.request<any>(
      this.api.get(`employee/deleteHolidayCalendar/${calendarId}`),
    );
    if (res?.success === false) throw new Error(res?.msg || 'Could not remove the calendar');
  }
}

function mapDay(d: any): HolidayDay {
  return {
    id: String(d?.id ?? ''),
    // Trimmed to 10 chars so a timestamp from the server still yields a date.
    date: String(d?.date ?? '').slice(0, 10),
    name: d?.name ?? '',
    recurring: d?.recurring === true,
  };
}

function mapCalendar(c: any): HolidayCalendar {
  return {
    id: String(c?.id ?? ''),
    name: c?.name ?? '',
    country: c?.country ?? null,
    branchIds: Array.isArray(c?.branchIds) ? c.branchIds.map(String) : [],
    days: Array.isArray(c?.days) ? c.days.map(mapDay) : [],
  };
}
