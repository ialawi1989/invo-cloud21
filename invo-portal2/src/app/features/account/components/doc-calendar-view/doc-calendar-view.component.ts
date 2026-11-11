import { ChangeDetectionStrategy, Component, computed, effect, input, signal, untracked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';

import { MycurrencyPipe } from '@core/pipes/mycurrency.pipe';

import { DocCardComponent } from '../doc-card/doc-card.component';
import { DocHScrollComponent } from '../doc-h-scroll/doc-h-scroll.component';
import { DocFetch, DocViewAdapter } from '../doc-views/doc-views.types';
import { DESKTOP_MIN, TABLET_MIN, injectViewportWidth } from '../doc-views/viewport-width';

/** 0 = Sunday … 6 = Saturday. */
const WEEK_STARTS_ON = 0;

const iso = (d: Date): string => {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

interface CalendarDay { date: Date; key: string; isToday: boolean; rows: any[]; total: number; }

/**
 * Calendar — documents placed on the date the API filters by (`adapter.dateKey`).
 * How many days show depends on the device: a phone shows ONE day, a tablet
 * THREE, a desktop the whole week. Prev / next / Today move by that many days.
 * Search and filters come from the list page via `fetch`; the visible range
 * replaces the list's date filter.
 */
@Component({
  selector: 'app-doc-calendar-view',
  standalone: true,
  imports: [CommonModule, TranslateModule, MycurrencyPipe, DocCardComponent, DocHScrollComponent],
  // Custom elements are inline by default — the calendar needs a width to scroll within.
  host: { class: 'block min-w-0 max-w-full' },
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './doc-calendar-view.component.html',
})
export class DocCalendarViewComponent {
  readonly fetch   = input.required<DocFetch>();
  readonly adapter = input.required<DocViewAdapter>();
  /** Changes whenever the list's search / filters change → reload. */
  readonly query   = input<unknown>(null);

  private readonly width = injectViewportWidth();
  /** Days on screen: 1 (phone) · 3 (tablet) · 7 (desktop week). */
  readonly count = computed<1 | 3 | 7>(() =>
    this.width() < TABLET_MIN ? 1 : this.width() < DESKTOP_MIN ? 3 : 7);

  /** First visible day. On the week layout it is always a week start. */
  private readonly anchor = signal<Date>(new Date());
  readonly start = computed(() => this.count() === 7 ? this.startOfWeek(this.anchor()) : this.dayOf(this.anchor()));
  readonly end   = computed(() => this.addDays(this.start(), this.count() - 1));

  private rows     = signal<any[]>([]);
  readonly loading = signal(false);
  private generation = 0;

  readonly days = computed<CalendarDay[]>(() => {
    const today = iso(new Date());
    const dateKey = this.adapter().dateKey;
    const byDay = new Map<string, any[]>();
    for (const r of this.rows()) {
      const k = String(r[dateKey] ?? '').slice(0, 10);
      byDay.set(k, [...(byDay.get(k) ?? []), r]);
    }
    return Array.from({ length: this.count() }, (_, i) => {
      const date = this.addDays(this.start(), i);
      const key = iso(date);
      const rows = byDay.get(key) ?? [];
      return {
        date, key, rows, isToday: key === today,
        total: rows.reduce((sum, r) => sum + (Number(r.total) || 0), 0),
      };
    });
  });

  constructor() {
    effect(() => {
      this.query();
      this.fetch();
      this.start();
      this.end();
      untracked(() => void this.load());
    });
  }

  prev(): void  { this.anchor.set(this.addDays(this.start(), -this.count())); }
  next(): void  { this.anchor.set(this.addDays(this.start(), this.count())); }
  today(): void { this.anchor.set(new Date()); }

  async load(): Promise<void> {
    const gen = ++this.generation;
    this.loading.set(true);
    try {
      // The API compares `date <= toDate` against a timestamp, which would drop
      // documents made later on the last day — so ask one day further and keep
      // only the visible dates below.
      const from = iso(this.start());
      const to = iso(this.end());
      const res = await this.fetch()({
        fromDate: from,
        toDate:   iso(this.addDays(this.end(), 1)),
        page: 1,
        limit: 999,
      });
      if (gen !== this.generation) return;
      const dateKey = this.adapter().dateKey;
      this.rows.set((res.list ?? []).filter(r => {
        const k = String(r[dateKey] ?? '').slice(0, 10);
        return k >= from && k <= to;
      }));
    } catch (e) {
      console.error('[doc-calendar] load failed', e);
      if (gen === this.generation) this.rows.set([]);
    } finally {
      if (gen === this.generation) this.loading.set(false);
    }
  }

  private dayOf(d: Date): Date { return new Date(d.getFullYear(), d.getMonth(), d.getDate()); }

  private startOfWeek(d: Date): Date {
    const s = this.dayOf(d);
    s.setDate(s.getDate() - ((s.getDay() - WEEK_STARTS_ON + 7) % 7));
    return s;
  }

  private addDays(d: Date, n: number): Date {
    const r = this.dayOf(d);
    r.setDate(r.getDate() + n);
    return r;
  }
}
