import '../../account-i18n';
import { ChangeDetectionStrategy, Component, inject, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';

import { LanguageService } from '@core/i18n/language.service';
import { SearchDropdownComponent } from '@shared/components/dropdown';
import { DatePickerComponent } from '@shared/components/datepicker/date-picker.component';

import { ymd } from '../../services/document-form-base';

export type RecurringPeriodicity = 'Weekly' | 'Monthly' | 'Yearly';

/** The schedule header every recurring profile (invoice, bill …) shares. */
export interface RecurringSchedule {
  name: string;
  /** `yyyy-MM-dd`. */
  startDate: string;
  endTerm: 'none' | 'by';
  /** `yyyy-MM-dd`; only meaningful when `endTerm == 'by'`. */
  endDate: string | null;
  repeatData: { periodicity: RecurringPeriodicity; periodQty: number; on: number };
}

interface Choice<T = string> { value: T; label: string; }

/** What `repeatData.on` means for a periodicity: Monthly -> day, Weekly -> weekday (1=Mon), Yearly -> month. */
export const PERIOD_MAX: Record<RecurringPeriodicity, number> = { Monthly: 31, Weekly: 7, Yearly: 12 };

/**
 * The "profile" card of a recurring document (legacy recurring-invoice / recurring-bill forms): profile name,
 * start date, when it ends, and the repeat rule (weekly / monthly / yearly, on which day, every N periods).
 * It edits the given schedule object in place and raises `changed`; the parent owns saving and validation.
 * `root` names the i18n section (`RECURRING_INVOICES` / `RECURRING_BILLS`) whose FORM / WEEKDAYS / MONTHS keys it reads.
 */
@Component({
  selector: 'app-recurring-schedule-card',
  standalone: true,
  imports: [FormsModule, TranslateModule, SearchDropdownComponent, DatePickerComponent],
  changeDetection: ChangeDetectionStrategy.Default,
  template: `
    @let r = rec();
    <section class="df-card">
      <h2 class="df-card__title">{{ root() + '.FORM.PROFILE' | translate }}</h2>

      <div class="df-row">
        <div class="df-field df-field--grow">
          <label for="rec-name">{{ root() + '.FORM.PROFILE_NAME' | translate }} <span class="req">*</span></label>
          <input id="rec-name" class="df-input" type="text" [class.is-invalid]="showErrors() && nameInvalid"
            [ngModel]="r.name" (ngModelChange)="onName($event)"/>
          @if (showErrors() && nameInvalid) { <p class="df-error">{{ 'DOC_LINES.ERR_REQUIRED' | translate }}</p> }
        </div>
      </div>

      <div class="rs-box">
      <div class="df-row">
        <div class="df-field df-field--grow">
          <label>{{ root() + '.FORM.START_DATE' | translate }} <span class="req">*</span></label>
          <app-date-picker [value]="startDate" [min]="minStart" (valueChange)="onStart($event)"/>
        </div>
        <div class="df-field df-field--grow">
          <label>{{ root() + '.FORM.END' | translate }}</label>
          <app-search-dropdown [items]="endTerms" [displayWith]="choiceLabel" [compareWith]="sameChoice" [searchable]="false"
            [value]="choice(endTerms, r.endTerm)" (valueChange)="onEndTerm($any($event))" [clearable]="false"/>
        </div>
        @if (r.endTerm === 'by') {
          <div class="df-field df-field--grow">
            <label>{{ root() + '.FORM.END_DATE' | translate }} <span class="req">*</span></label>
            <app-date-picker [value]="endDate" [min]="startDate" (valueChange)="onEnd($event)"/>
          </div>
        }
      </div>

      <div class="df-row">
        <div class="df-field df-field--grow">
          <label>{{ root() + '.FORM.PERIODICITY' | translate }}</label>
          <app-search-dropdown [items]="periodicities" [displayWith]="choiceLabel" [compareWith]="sameChoice" [searchable]="false"
            [value]="choice(periodicities, r.repeatData.periodicity)" (valueChange)="onPeriodicity($any($event))" [clearable]="false"/>
        </div>
        <div class="df-field df-field--grow">
          <label>{{ onLabelKey | translate }}</label>
          <app-search-dropdown [items]="onOptions" [displayWith]="choiceLabel" [compareWith]="sameChoice" [searchable]="false"
            [value]="onOption()" (valueChange)="onOnPick($any($event))" [clearable]="false"/>
        </div>
        <div class="df-field df-field--grow">
          <label for="rec-every">{{ root() + '.FORM.EVERY' | translate }}</label>
          <div class="rs-every">
            <input id="rec-every" class="df-input" type="number" min="1" step="1"
              [ngModel]="r.repeatData.periodQty" (ngModelChange)="onEvery($event)"/>
            <span class="rs-every__unit">{{ unitKey | translate }}</span>
          </div>
        </div>
      </div>
      </div>
      <ng-content/>
    </section>
  `,
  styles: [`
    .rs-box { background: #eefafa; border: 1px solid #d3eef0; border-radius: 12px; padding: 16px; margin-top: 4px; display: flex; flex-direction: column; gap: 14px; }
    .rs-every { display: flex; align-items: center; gap: 10px; }
    .rs-every .df-input { flex: 1; min-width: 0; }
    .rs-every__unit { color: #64748b; font-size: 13px; white-space: nowrap; }
  `],
})
export class RecurringScheduleCardComponent {
  private lang = inject(LanguageService);

  rec = input.required<RecurringSchedule>();
  root = input<string>('RECURRING_INVOICES');
  /** A new profile can't start in the past (legacy `minDate: today`); an existing one keeps its date. */
  isNew = input<boolean>(true);
  showErrors = input<boolean>(false);
  changed = output<void>();

  private t = (k: string) => this.lang.instant(k);

  get periodicities(): Choice<RecurringPeriodicity>[] {
    const R = this.root() + '.FORM.';
    return [
      { value: 'Weekly', label: this.t(R + 'WEEKLY') },
      { value: 'Monthly', label: this.t(R + 'MONTHLY') },
      { value: 'Yearly', label: this.t(R + 'YEARLY') },
    ];
  }
  get endTerms(): Choice[] {
    const R = this.root() + '.FORM.';
    return [{ value: 'none', label: this.t(R + 'END_NONE') }, { value: 'by', label: this.t(R + 'END_BY') }];
  }

  private optionsFor = '';
  private optionsCache: Choice<number>[] = [];
  /** The "On" choices of the current periodicity (day numbers / weekday names / month names). */
  get onOptions(): Choice<number>[] {
    const p = this.rec().repeatData.periodicity;
    const key = `${this.root()}|${p}`;
    if (key !== this.optionsFor) {
      this.optionsFor = key;
      this.optionsCache = Array.from({ length: PERIOD_MAX[p] }, (_, i) => {
        const n = i + 1;
        return { value: n, label: p === 'Monthly' ? String(n) : this.t(`${this.root()}.${p === 'Weekly' ? 'WEEKDAYS' : 'MONTHS'}.${n}`) };
      });
    }
    return this.optionsCache;
  }
  onOption = () => this.onOptions.find(o => o.value === this.rec().repeatData.on) ?? null;

  get onLabelKey(): string {
    const p = this.rec().repeatData.periodicity;
    return this.root() + (p === 'Weekly' ? '.FORM.ON_WEEKDAY' : p === 'Yearly' ? '.FORM.ON_MONTH' : '.FORM.ON_DAY');
  }
  get unitKey(): string {
    const p = this.rec().repeatData.periodicity;
    return this.root() + (p === 'Weekly' ? '.FORM.WEEK' : p === 'Yearly' ? '.FORM.YEAR' : '.FORM.MONTH');
  }

  get nameInvalid(): boolean { return !this.rec().name?.trim(); }

  // ── dates ──────────────────────────────────────────────────────────
  private dates = new Map<string, Date>();
  /** `yyyy-MM-dd` -> local-midnight `Date` (memoised so the picker keeps one instance between checks). */
  private localDate(s: string | null): Date | null {
    if (!s) return null;
    let d = this.dates.get(s);
    if (!d) {
      const [y, m, day] = s.slice(0, 10).split('-').map(Number);
      d = new Date(y, (m || 1) - 1, day || 1);
      this.dates.set(s, d);
    }
    return d;
  }
  get startDate(): Date | null { return this.localDate(this.rec().startDate); }
  get endDate(): Date | null { return this.localDate(this.rec().endDate); }
  get minStart(): Date | null {
    if (!this.isNew()) return null;
    const t = new Date();
    return new Date(t.getFullYear(), t.getMonth(), t.getDate());
  }

  // ── handlers ───────────────────────────────────────────────────────
  choice = <T>(list: Choice<T>[], value: T) => list.find(x => x.value === value) ?? null;
  choiceLabel = (c: Choice<any>) => c?.label ?? '';
  sameChoice = (a: Choice<any>, b: Choice<any>) => a?.value === b?.value;

  onName(v: string): void { this.rec().name = v; this.changed.emit(); }

  onStart(v: any): void {
    if (!(v instanceof Date)) return;
    const r = this.rec();
    r.startDate = ymd(v);
    if (r.endTerm === 'by' && (!r.endDate || r.endDate < r.startDate)) r.endDate = r.startDate;
    this.changed.emit();
  }

  onEndTerm(c: Choice | null): void {
    const r = this.rec();
    r.endTerm = (c?.value as any) === 'by' ? 'by' : 'none';
    r.endDate = r.endTerm === 'by' ? (r.endDate || r.startDate) : null;
    this.changed.emit();
  }

  onEnd(v: any): void {
    if (!(v instanceof Date)) return;
    this.rec().endDate = ymd(v);
    this.changed.emit();
  }

  onPeriodicity(c: Choice<RecurringPeriodicity> | null): void {
    const r = this.rec();
    const p = c?.value ?? 'Monthly';
    r.repeatData.periodicity = p;
    // The "on" value means a different thing per periodicity - keep it only while it is still valid.
    if (r.repeatData.on > PERIOD_MAX[p]) r.repeatData.on = 1;
    this.changed.emit();
  }

  onOnPick(o: Choice<number> | null): void { this.rec().repeatData.on = o?.value ?? 1; this.changed.emit(); }

  onEvery(v: any): void {
    const n = Math.floor(Number(v));
    this.rec().repeatData.periodQty = Number.isFinite(n) && n > 0 ? n : 1;
    this.changed.emit();
  }
}
