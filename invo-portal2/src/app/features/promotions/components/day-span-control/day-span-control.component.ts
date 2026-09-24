import { ChangeDetectionStrategy, Component, effect, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';

import { SearchDropdownComponent } from '@shared/components/dropdown/search-dropdown.component';
import { DaySpan, PeriodUnit } from '../../models/common.model';

/**
 * Number + unit (years / months / weeks / days) editor. Same behaviour as the
 * legacy `invo-daySpan-controls`: it edits a copy of `value` and emits the
 * whole span on every change; the unit picker is the shared search-dropdown
 * instead of a native select.
 */
@Component({
  selector: 'app-day-span-control',
  standalone: true,
  imports: [FormsModule, TranslateModule, SearchDropdownComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="dsc">
      <input type="number" class="dsc__num" min="0"
        [ngModel]="internal().value" (ngModelChange)="setValue($event)"/>
      <app-search-dropdown class="dsc__unit"
        [items]="units"
        [displayWith]="display"
        [compareWith]="compare"
        [toValue]="toValue"
        [clearable]="false"
        [searchable]="false"
        [value]="selectedUnit()"
        (valueChange)="setUnit($any($event))"/>
    </div>
  `,
  styles: [`
    .dsc { display: flex; gap: 8px; align-items: stretch; }
    .dsc__num {
      width: 110px; padding: 9px 12px; border: 1px solid #d0d5dd; border-radius: 8px;
      font-size: 13.5px; color: #0f172a;
    }
    .dsc__num:focus { outline: none; border-color: #2691a4; box-shadow: 0 0 0 3px rgba(38,145,164,.12); }
    .dsc__unit { flex: 1; min-width: 140px; }
  `],
})
export class DaySpanControlComponent {
  value = input<DaySpan>({ value: 0, periodUnit: PeriodUnit.DAYS });
  valueChange = output<DaySpan>();

  internal = signal<DaySpan>({ value: 0, periodUnit: PeriodUnit.DAYS });

  units = [
    { value: PeriodUnit.YEARS,  label: 'PROMOTIONS.CUSTOMER_TIERS.YEARS' },
    { value: PeriodUnit.MONTHS, label: 'PROMOTIONS.CUSTOMER_TIERS.MONTHS' },
    { value: PeriodUnit.WEEKS,  label: 'PROMOTIONS.CUSTOMER_TIERS.WEEKS' },
    { value: PeriodUnit.DAYS,   label: 'PROMOTIONS.CUSTOMER_TIERS.DAYS' },
  ];

  constructor() {
    effect(() => this.internal.set({ ...this.value() }), { allowSignalWrites: true });
  }

  selectedUnit = () => this.units.find(u => u.value === this.internal().periodUnit) ?? null;
  display = (item: any) => item?.label ?? '';
  compare = (a: any, b: any) => (a?.value ?? a) === (b?.value ?? b);
  toValue = (item: any) => item?.value ?? item;

  setValue(v: number): void {
    this.internal.update(s => ({ ...s, value: v }));
    this.valueChange.emit(this.internal());
  }

  setUnit(item: any): void {
    const unit = (item && typeof item === 'object' ? item.value : item) ?? PeriodUnit.DAYS;
    this.internal.update(s => ({ ...s, periodUnit: unit }));
    this.valueChange.emit(this.internal());
  }
}
