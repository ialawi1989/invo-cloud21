import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { ResolvedPage } from '../../core/page-types/page-type.types';
import { ShopperAuthService } from '../blog/services/shopper-auth.service';
import { BookingApiService, BookingBranch } from './booking.api';

/**
 * Booking — the `booking` page type.
 *
 * Covers table reservations. The legacy storefront had `table-reservation` and
 * `appointments` as two pages with identical settings; they are one type here,
 * distinguished by the page's `booking_kind` setting rather than by two routes
 * and two components.
 *
 * Appointments are deliberately NOT wired to this form. That flow holds slots,
 * resolves an employee and renews holds while the customer decides — a
 * name/date/guests form cannot stand in for it, and pretending otherwise would
 * take a booking the backend never made.
 */
@Component({
  selector: 'app-booking-page',
  standalone: true,
  imports: [CommonModule, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="bk">
      <header class="bk__head">
        <h1 class="bk__title">{{ page().name || 'Book a table' }}</h1>
      </header>

      @if (kind() === 'appointment') {
        <div class="bk__state">
          <p class="bk__state-title">Appointment booking isn't available here yet</p>
          <p class="bk__muted">It needs the slot-hold flow, which is still being moved over.</p>
        </div>
      } @else if (done()) {
        <div class="bk__state">
          <p class="bk__state-title">Your table is booked</p>
          @if (reference()) { <p class="bk__muted">Reference: {{ reference() }}</p> }
          <button type="button" class="bk__btn" (click)="again()">Book another</button>
        </div>
      } @else {
        <form class="bk__form" (ngSubmit)="submit()">
          @if (branches().length > 1) {
            <label class="bk__field">
              <span>Branch</span>
              <select [(ngModel)]="branchId" name="branchId" required>
                @for (b of branches(); track b.id) {
                  <option [value]="b.id">{{ b.name }}</option>
                }
              </select>
            </label>
          }

          <div class="bk__row">
            <label class="bk__field">
              <span>Date</span>
              <input type="date" [(ngModel)]="date" name="date" [min]="today" required/>
            </label>
            <label class="bk__field">
              <span>Time</span>
              <input type="time" [(ngModel)]="time" name="time" required/>
            </label>
            <label class="bk__field bk__field--narrow">
              <span>Guests</span>
              <input type="number" min="1" [(ngModel)]="guests" name="guests" required/>
            </label>
          </div>

          <div class="bk__row">
            <label class="bk__field">
              <span>Name</span>
              <input type="text" [(ngModel)]="name" name="name" required/>
            </label>
            <label class="bk__field">
              <span>Phone</span>
              <input type="tel" [(ngModel)]="phone" name="phone" required/>
            </label>
          </div>

          <label class="bk__field">
            <span>Note <small>(optional)</small></span>
            <textarea rows="3" [(ngModel)]="note" name="note"></textarea>
          </label>

          @if (error()) { <p class="bk__error">{{ error() }}</p> }

          <button type="submit" class="bk__btn" [disabled]="!canSubmit() || saving()">
            {{ saving() ? 'Booking…' : 'Book a table' }}
          </button>
        </form>
      }
    </section>
  `,
  styles: [`
    .bk { max-width: 640px; margin: 0 auto; padding: 28px 20px 56px; }
    .bk__head { margin-bottom: 18px; }
    .bk__title { margin: 0; font-size: 26px; font-weight: 700; color: #111827; }

    .bk__form { display: grid; gap: 14px; }
    .bk__row { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 14px; }
    .bk__field { display: flex; flex-direction: column; gap: 6px; font-size: 13px; color: #4b5563; }
    .bk__field--narrow { max-width: 140px; }
    .bk__field small { color: #9ca3af; }
    .bk__field input, .bk__field select, .bk__field textarea {
      padding: 9px 11px; border: 1px solid #e1e5eb; border-radius: 10px;
      font: inherit; color: #111827; background: #fff;
    }
    .bk__field input:focus, .bk__field select:focus, .bk__field textarea:focus {
      outline: 2px solid #6d3bf5; outline-offset: 1px;
    }

    .bk__btn {
      justify-self: start; padding: 11px 22px; border: 0; border-radius: 999px;
      background: #6d3bf5; color: #fff; font-size: 14px; font-weight: 600; cursor: pointer;
    }
    .bk__btn:disabled { opacity: .55; cursor: default; }

    .bk__error { margin: 0; color: #dc2626; font-size: 13px; }
    .bk__state { padding: 56px 0; text-align: center; }
    .bk__state-title { margin: 0 0 6px; font-size: 17px; font-weight: 600; color: #374151; }
    .bk__muted { color: #6b7280; font-size: 14px; margin: 0; }
  `],
})
export class BookingPage {
  private api  = inject(BookingApiService);
  private auth = inject(ShopperAuthService);

  page = input.required<ResolvedPage>();

  branches  = signal<BookingBranch[]>([]);
  saving    = signal<boolean>(false);
  done      = signal<boolean>(false);
  reference = signal<string>('');
  error     = signal<string>('');

  readonly today = new Date().toISOString().slice(0, 10);

  branchId = '';
  date     = this.today;
  time     = '';
  guests   = 2;
  name     = '';
  phone    = '';
  note     = '';

  /** `table` (default) or `appointment`, from the page's settings. */
  kind = computed<string>(() => String(this.page().settings['booking_kind'] ?? 'table'));

  canSubmit = computed<boolean>(() => true);

  constructor() {
    queueMicrotask(() => void this.init());
  }

  private async init(): Promise<void> {
    const list = await this.api.branches();
    this.branches.set(list);
    if (!this.branchId && list.length) this.branchId = list[0].id;

    // Prefill from the signed-in shopper — a customer who is already known
    // shouldn't retype their own name.
    const who = this.auth.current();
    if (who) {
      this.name  = this.name  || who.name  || '';
      this.phone = this.phone || (who as any).mobile || '';
    }
  }

  async submit(): Promise<void> {
    this.error.set('');
    if (!this.name.trim() || !this.phone.trim() || !this.date || !this.time) {
      this.error.set('Please fill in the date, time, name and phone.');
      return;
    }

    this.saving.set(true);
    try {
      const res = await this.api.reserve({
        branchId: this.branchId,
        name:     this.name.trim(),
        phone:    this.phone.trim(),
        guests:   Number(this.guests) || 1,
        date:     this.date,
        time:     this.time,
        note:     this.note.trim(),
      });

      if (res.ok) {
        this.reference.set(res.ref ?? '');
        this.done.set(true);
      } else {
        this.error.set(res.msg || 'That booking could not be made. Please try another time.');
      }
    } finally {
      this.saving.set(false);
    }
  }

  again(): void {
    this.done.set(false);
    this.reference.set('');
    this.time = '';
    this.note = '';
  }
}
