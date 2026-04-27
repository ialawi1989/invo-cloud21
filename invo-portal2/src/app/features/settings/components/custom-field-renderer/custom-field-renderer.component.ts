import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';

import { DatePickerComponent } from '@shared/components/datepicker/date-picker.component';
import { TimePickerComponent } from '@shared/components/time-picker/time-picker.component';
import { ColorPickerComponent } from '@shared/components/color-picker/color-picker.component';
import { SearchDropdownComponent } from '@shared/components/dropdown/search-dropdown.component';

import { CustomField, CustomFieldOption } from '../../models/custom-field.types';

/**
 * <app-custom-field-renderer>
 * ───────────────────────────
 * Single source of truth for rendering a `CustomField` definition on
 * an entity form. Picks the right control per `field.type`:
 *
 *   text / email / url / phone   → `<input>` with the matching `type` + maxlength
 *   textarea                     → `<textarea>` with maxlength
 *   number                       → `<input type="number">` with min/max + display kind
 *   select                       → `<app-search-dropdown>` (single or multi)
 *   boolean                      → labelled toggle
 *   date / datetime              → `<app-date-picker>` (`[showTime]` for datetime)
 *   time                         → `<app-time-picker>`
 *   color                        → `<app-color-picker>`
 *
 * The component is "dumb" — the parent owns the FormControl, sets up
 * validators (required, maxLength, min, max) and reads the current
 * value back. The renderer only knows how to draw the right widget.
 */
@Component({
  selector: 'app-custom-field-renderer',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    TranslateModule,
    DatePickerComponent,
    TimePickerComponent,
    ColorPickerComponent,
    SearchDropdownComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './custom-field-renderer.component.html',
  styleUrl: './custom-field-renderer.component.scss',
  // Bind grid-column on the *host* so the cell actually spans inside
  // the parent's 12-column grid. Putting it on the inner `.cfr` div
  // collapses the host element to content width and breaks the grid.
  host: {
    '[style.grid-column]': 'gridSpan()',
  },
})
export class CustomFieldRendererComponent {
  /** The field definition (loaded from settings → custom fields). */
  field = input.required<CustomField>();

  /** The FormControl this field is bound to on the parent form. */
  control = input.required<FormControl>();

  /** Optional ID prefix for the `<label for="…">`/`<input id="…">` wiring. */
  idPrefix = input<string>('cf');

  /** Stable id for the underlying input — drives `for`/`id` linkage. */
  inputId = computed<string>(() => `${this.idPrefix()}-${this.field().abbr || this.field().id}`);

  /** Items for the search-dropdown when type is `select`. */
  options = computed<CustomFieldOption[]>(() => this.field().customOptions ?? []);

  /** CSS `grid-column` value for the host — drives the col-N width. */
  gridSpan = computed<string>(() => {
    switch (this.field().gridTemplate) {
      case 'col-4':  return 'span 4';
      case 'col-6':  return 'span 6';
      default:       return 'span 12';
    }
  });

  // ─── Display helpers ───────────────────────────────────────────────────
  /** Pretty placeholder per type — keeps the empty state self-explanatory. */
  placeholder = computed<string>(() => {
    switch (this.field().type) {
      case 'email':    return 'name@example.com';
      case 'url':      return 'https://';
      case 'phone':    return '+1 555 0100';
      case 'color':    return '#RRGGBB';
      default:         return this.field().name || '';
    }
  });

  /** True for the input types that share the maxlength knob. */
  isInputLike(): boolean {
    const t = this.field().type;
    return t === 'text' || t === 'email' || t === 'url' || t === 'phone';
  }

  /** Map our `numberDisplayType` to a step + suffix hint for the input. */
  numberStep(): number {
    return this.field().numberDisplayType === 'integer' ? 1 : 0.01;
  }

  /** Translate from our search-dropdown option object to the stored value. */
  optionToValue = (o: CustomFieldOption): string => o.value || o.label;
  optionLabel   = (o: CustomFieldOption): string => o.label || o.value;
  /** Match by `value`, tolerating either a raw value or a wrapped option. */
  optionEquals = (a: CustomFieldOption | string, b: CustomFieldOption | string): boolean => {
    const av = typeof a === 'string' ? a : (a?.value ?? a?.label);
    const bv = typeof b === 'string' ? b : (b?.value ?? b?.label);
    return av === bv;
  };
}
