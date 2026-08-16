import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

import { withTranslations } from '@core/i18n/with-translations';
import { BreadcrumbsComponent } from '@shared/components/breadcrumbs/breadcrumbs.component';
import type { BreadcrumbItem } from '@shared/components/breadcrumbs/breadcrumbs.types';
import { LoadingOverlayComponent } from '@shared/components/spinner/loading-overlay.component';
import { ToastService } from '@shared/components/toast/toast.service';

import { HolidayCalendarService } from '../../services/holiday-calendar.service';
import {
  HolidayCalendar,
  HolidayDay,
  duplicateDates,
} from '../../services/holiday-calendar.types';

/**
 * Holiday calendars — the last piece of Leave.
 *
 * `employeeLeaveTypes.ts:6` says plainly that no holiday calendar exists
 * anywhere in this codebase, and that is why `suggestedDays()` excludes rest
 * days but not public holidays.
 *
 * ── THIS SCREEN DOES NOT CHANGE ANY LEAVE FIGURE ─────────────────────────────
 * It manages the calendar and nothing else. It does not touch a stored
 * request's `days`, and it does not decide whether the leave suggestion
 * accounts for holidays — the SERVER owns that, and says so through
 * `suggestionExcludesPublicHolidays` on `leaveCatalog`.
 *
 * That is deliberate and is what makes building this safe. If `days` were
 * derived live, adding a single holiday would retroactively restate every
 * balance in the system. And if the portal inferred "a calendar exists,
 * therefore holidays are handled", the disclaimer would vanish while the count
 * was still wrong. Both failures are silent; both are avoided by leaving the
 * flag to the server, which flips it the day the backend starts excluding
 * holidays — with no portal release.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * ── THE BACKEND DOES NOT SERVE THIS YET ──────────────────────────────────────
 * Built frontend-first. When the endpoints are absent the screen says so and
 * offers nothing, rather than rendering an empty list that reads as "this
 * company observes no public holidays" — see the unavailable banner.
 * ─────────────────────────────────────────────────────────────────────────────
 */
@Component({
  selector: 'app-holiday-calendars',
  standalone: true,
  imports: [TranslateModule, BreadcrumbsComponent, LoadingOverlayComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './holiday-calendars.component.html',
  styleUrl: './holiday-calendars.component.scss',
})
export class HolidayCalendarsComponent implements OnInit {
  private service = inject(HolidayCalendarService);
  private translate = inject(TranslateService);
  private destroyRef = inject(DestroyRef);
  private toast = inject(ToastService);
  private router = inject(Router);

  loading = signal(false);
  saving = signal(false);
  calendars = signal<HolidayCalendar[]>([]);
  /** Which calendar is expanded. Only one at a time — these are long lists. */
  openId = signal<string | null>(null);

  /** False when the endpoints are absent. Drives the banner, not an empty list. */
  available = signal(true);
  unavailableReason = signal<string | null>(null);

  private i18nTick = signal(0);

  breadcrumbs = computed<BreadcrumbItem[]>(() => {
    this.i18nTick();
    return [
      { label: this.translate.instant('EMPLOYEES.TITLE'), routerLink: '/employees' },
      { label: this.translate.instant('EMPLOYEES.HOLIDAYS.TITLE') },
    ];
  });

  /** Duplicate dates per calendar id — surfaced before save, not after. */
  duplicates = computed<Record<string, string[]>>(() => {
    const out: Record<string, string[]> = {};
    for (const c of this.calendars()) {
      const dupes = duplicateDates(c.days);
      if (dupes.length) out[c.id] = dupes;
    }
    return out;
  });

  constructor() {
    withTranslations('employees');
    this.translate.onLangChange
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.i18nTick.update(n => n + 1));
  }

  async ngOnInit(): Promise<void> {
    await this.load();
  }

  private async load(): Promise<void> {
    this.loading.set(true);
    try {
      const list = await this.service.list();
      const availability = this.service.lastAvailability();
      this.available.set(availability.available);
      this.unavailableReason.set(availability.reason);
      this.calendars.set(list);
    } finally {
      this.loading.set(false);
    }
  }

  toggle(id: string): void {
    this.openId.update(cur => (cur === id ? null : id));
  }

  addCalendar(): void {
    // A local draft with an empty id. The server mints the real one on save;
    // until then the empty id is what marks it as never-saved.
    this.calendars.update(list => [
      ...list,
      { id: '', name: '', country: null, branchIds: [], days: [] },
    ]);
    this.openId.set('');
  }

  addDay(calendarId: string): void {
    this.calendars.update(list => list.map(c => c.id !== calendarId ? c : {
      ...c,
      days: [...c.days, { id: '', date: '', name: '', recurring: false }],
    }));
  }

  removeDay(calendarId: string, index: number): void {
    this.calendars.update(list => list.map(c => c.id !== calendarId ? c : {
      ...c,
      days: c.days.filter((_, i) => i !== index),
    }));
  }

  updateDay(calendarId: string, index: number, patch: Partial<HolidayDay>): void {
    this.calendars.update(list => list.map(c => c.id !== calendarId ? c : {
      ...c,
      days: c.days.map((d, i) => (i === index ? { ...d, ...patch } : d)),
    }));
  }

  updateCalendar(calendarId: string, patch: Partial<HolidayCalendar>): void {
    this.calendars.update(list => list.map(c => (c.id !== calendarId ? c : { ...c, ...patch })));
  }

  onDayDate(calendarId: string, index: number, event: Event): void {
    this.updateDay(calendarId, index, { date: (event.target as HTMLInputElement).value });
  }

  onDayName(calendarId: string, index: number, event: Event): void {
    this.updateDay(calendarId, index, { name: (event.target as HTMLInputElement).value });
  }

  onDayRecurring(calendarId: string, index: number, event: Event): void {
    this.updateDay(calendarId, index, { recurring: (event.target as HTMLInputElement).checked });
  }

  onCalendarName(calendarId: string, event: Event): void {
    this.updateCalendar(calendarId, { name: (event.target as HTMLInputElement).value });
  }

  onCalendarCountry(calendarId: string, event: Event): void {
    this.updateCalendar(calendarId, { country: (event.target as HTMLInputElement).value || null });
  }

  async save(calendar: HolidayCalendar): Promise<void> {
    if (!calendar.name.trim()) {
      this.toast.error('EMPLOYEES.HOLIDAYS.NAME_REQUIRED');
      return;
    }
    if (duplicateDates(calendar.days).length) {
      this.toast.error('EMPLOYEES.HOLIDAYS.DUPLICATE_DATES');
      return;
    }
    this.saving.set(true);
    try {
      await this.service.save(calendar);
      this.toast.success('EMPLOYEES.HOLIDAYS.SAVED');
      await this.load();
    } catch (e: any) {
      this.toast.error('COMMON.SAVE_FAILED', e?.message);
    } finally {
      this.saving.set(false);
    }
  }

  async remove(calendar: HolidayCalendar): Promise<void> {
    if (!calendar.id) {
      // Never saved — drop the draft without asking the server about it.
      this.calendars.update(list => list.filter(c => c !== calendar));
      return;
    }
    this.saving.set(true);
    try {
      await this.service.remove(calendar.id);
      await this.load();
    } catch (e: any) {
      this.toast.error('COMMON.SAVE_FAILED', e?.message);
    } finally {
      this.saving.set(false);
    }
  }

  back(): void {
    this.router.navigate(['/employees']);
  }

  trackCalendar = (_: number, c: HolidayCalendar) => c.id || c;
  trackDay = (i: number) => i;
}
