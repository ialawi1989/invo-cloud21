import { ChangeDetectionStrategy, Component, computed, inject, input, model } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';

import { LanguageService } from '@core/i18n/language.service';
import { SearchDropdownComponent } from '@shared/components/dropdown/search-dropdown.component';

import { PERIOD_TYPES, PeriodAnchor, PeriodType } from '../../models/sales-target.model';

interface Opt<T> { value: T; label: string; }

/**
 * The period picker of the sales target screens: the period type (monthly / quarterly / yearly) and the anchor that
 * belongs to it - month + year, quarter + year, or the year. Two-way `value`; the type can be hidden (`showPeriod`)
 * when the screen fixes it.
 */
@Component({
  selector: 'app-st-period-anchor',
  standalone: true,
  imports: [SearchDropdownComponent, TranslateModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="pa">
      @if (showPeriod()) {
        <div class="pa__cell">
          <app-search-dropdown
            [items]="periods()" [value]="selected(periods(), value().period)" (valueChange)="onPeriod($event)"
            [displayWith]="label" [compareWith]="same" [toValue]="val" [searchable]="false" [clearable]="false"/>
        </div>
      }
      @if (value().period === 'monthly') {
        <div class="pa__cell">
          <app-search-dropdown
            [items]="months()" [value]="selected(months(), value().month)" (valueChange)="onMonth($event)"
            [displayWith]="label" [compareWith]="same" [toValue]="val" [searchable]="false" [clearable]="false"/>
        </div>
      }
      @if (value().period === 'quarterly') {
        <div class="pa__cell pa__cell--sm">
          <app-search-dropdown
            [items]="quarters" [value]="selected(quarters, value().quarter)" (valueChange)="onQuarter($event)"
            [displayWith]="label" [compareWith]="same" [toValue]="val" [searchable]="false" [clearable]="false"/>
        </div>
      }
      <div class="pa__cell pa__cell--sm">
        <app-search-dropdown
          [items]="years()" [value]="selected(years(), value().year)" (valueChange)="onYear($event)"
          [displayWith]="label" [compareWith]="same" [toValue]="val" [searchable]="false" [clearable]="false"/>
      </div>
    </div>
  `,
  styles: [`
    :host { display: block; }
    .pa { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }
    .pa__cell { min-width: 150px; }
    .pa__cell--sm { min-width: 110px; }
  `],
})
export class PeriodAnchorComponent {
  private lang = inject(LanguageService);

  value = model.required<PeriodAnchor>();
  showPeriod = input(true);

  readonly quarters: Opt<number>[] = [1, 2, 3, 4].map(q => ({ value: q, label: 'Q' + q }));

  periods = computed<Opt<PeriodType>[]>(() => PERIOD_TYPES.map(p => ({ value: p, label: this.lang.instant('SALES_TARGET.PERIOD.' + p) })));

  months = computed<Opt<number>[]>(() => {
    const locale = this.lang.current();
    return Array.from({ length: 12 }, (_, i) => ({ value: i + 1, label: new Date(2000, i, 1).toLocaleString(locale, { month: 'long' }) }));
  });

  /** Two years either side of the current one, plus the selected year when a saved target is further away. */
  years = computed<Opt<number>[]>(() => {
    const y = new Date().getFullYear();
    const set = new Set([y - 2, y - 1, y, y + 1, y + 2, this.value().year]);
    return [...set].sort((a, b) => a - b).map(v => ({ value: v, label: String(v) }));
  });

  label = (o: Opt<any> | null) => o?.label ?? '';
  same = (a: Opt<any> | null, b: Opt<any> | null) => a?.value === b?.value;
  val = (o: Opt<any> | null) => o?.value ?? null;
  selected<T>(list: Opt<T>[], v: T): Opt<T> | null { return list.find(o => o.value === v) ?? null; }

  private pick<T>(v: Opt<T> | Opt<T>[] | null): T | null { const o = Array.isArray(v) ? v[0] : v; return o ? o.value : null; }

  onPeriod(v: Opt<PeriodType> | Opt<PeriodType>[] | null): void { const p = this.pick(v); if (p) this.value.set({ ...this.value(), period: p }); }
  onMonth(v: Opt<number> | Opt<number>[] | null): void { const m = this.pick(v); if (m) this.value.set({ ...this.value(), month: m }); }
  onQuarter(v: Opt<number> | Opt<number>[] | null): void { const q = this.pick(v); if (q) this.value.set({ ...this.value(), quarter: q }); }
  onYear(v: Opt<number> | Opt<number>[] | null): void { const y = this.pick(v); if (y) this.value.set({ ...this.value(), year: y }); }
}
