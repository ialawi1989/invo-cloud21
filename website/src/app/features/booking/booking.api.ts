import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

import { environment } from '../../../environments/environment';
import { TenantService } from '../blog/services/tenant.service';
import { ShopperAuthService } from '../blog/services/shopper-auth.service';

interface Envelope<T> { success: boolean; msg: string; data: T; }

export interface BookingBranch {
  id:   string;
  name: string;
}

export interface ReservationRequest {
  branchId: string;
  name:     string;
  phone:    string;
  guests:   number;
  /** Local date, `yyyy-MM-dd`. */
  date:     string;
  /** Local time, `HH:mm`. */
  time:     string;
  note?:    string;
}

export interface BookingResult {
  ok:   boolean;
  msg?: string;
  ref?: string;
}

/**
 * Table reservations for the `booking` page type.
 *
 * Posts to the existing `ecommerce/:sub/reservation/saveReservation`, in the
 * shape the old storefront's `Reservation` model used — the backend contract is
 * unchanged, only the page around it.
 *
 * Appointments are a different flow (slot holds, employee resolution, renewals)
 * and are NOT handled here; the page says so rather than pretending a table
 * form can book one.
 */
@Injectable({ providedIn: 'root' })
export class BookingApiService {
  private http   = inject(HttpClient);
  private tenant = inject(TenantService);
  private auth   = inject(ShopperAuthService);

  private url(scope: string, action: string): string {
    return `${environment.apiBase}/v1/ecommerce/${encodeURIComponent(this.tenant.slug())}/${scope}/${action}`;
  }

  private headers(): HttpHeaders {
    const sid = this.auth.sessionId();
    return new HttpHeaders({
      'X-Sub-Domain': this.tenant.slug(),
      ...(sid ? { 'session-id': sid } : {}),
    });
  }

  /** Branches a customer can book at. */
  async branches(): Promise<BookingBranch[]> {
    try {
      const env = await firstValueFrom(
        this.http.get<Envelope<any>>(this.url('branch', 'getBranches'), { headers: this.headers() }),
      );
      const list: any[] = Array.isArray(env?.data?.list) ? env.data.list
        : Array.isArray(env?.data) ? env.data : [];
      return list
        .map(b => ({ id: String(b?.id ?? ''), name: String(b?.name ?? '') }))
        .filter(b => b.id);
    } catch {
      return [];
    }
  }

  async reserve(req: ReservationRequest): Promise<BookingResult> {
    try {
      // `reservationDate` is one instant built from the picked date + time, the
      // same way the old form did it — sending them separately would leave the
      // backend guessing at a timezone.
      const reservationDate = new Date(`${req.date}T${req.time || '00:00'}`);

      const env = await firstValueFrom(
        this.http.post<Envelope<any>>(
          this.url('reservation', 'saveReservation'),
          {
            branchId:      req.branchId,
            guests:        req.guests,
            note:          req.note ?? '',
            reservationDate,
            name:          req.name,
            phone:         req.phone,
            customerName:  req.name,
            customerPhone: req.phone,
            sessionId:     this.auth.sessionId(),
          },
          { headers: this.headers(), withCredentials: true },
        ),
      );

      if (env?.success === false) return { ok: false, msg: env?.msg };
      return { ok: true, ref: String(env?.data?.id ?? env?.data?.reference ?? '') };
    } catch (e: any) {
      return { ok: false, msg: e?.error?.msg ?? e?.message };
    }
  }
}
