import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  OnChanges,
  OnInit,
  SimpleChanges,
  forwardRef,
  inject,
  input,
  model,
  output,
} from '@angular/core';
import { ControlValueAccessor, FormsModule, NG_VALUE_ACCESSOR } from '@angular/forms';

import { CountriesService, Country } from '@shared/services/countries.service';
import { SearchDropdownComponent } from '@shared/components/dropdown/search-dropdown.component';

interface DialOption { value: string; label: string; names: string[] }

/**
 * Country dial code + phone number field (port of the legacy `app-phone-input`).
 *
 * Two ways to use it:
 *  1. Two values kept apart: `<app-phone-input [(countryCode)]="code" [(number)]="phone"/>`
 *  2. As a form control holding ONE combined string ("+97333221100"):
 *     `<app-phone-input formControlName="phone" [defaultCountryCode]="'+973'"/>`
 *     - A stored value starting with "+" is split into code + number using the
 *       longest matching dial code.
 *     - A stored value WITHOUT "+" (legacy data) is shown as the number with an
 *       empty code and written back unchanged unless a code is picked.
 *     - `defaultCountryCode` only pre-selects the code for an empty value; the
 *       control stays empty until a number is typed.
 * Several countries share a dial code (+1), so options are unique per dial code
 * and the search also matches country names.
 */
@Component({
  selector: 'app-phone-input',
  standalone: true,
  imports: [FormsModule, SearchDropdownComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [{ provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => PhoneInputComponent), multi: true }],
  template: `
    <div class="pi" [class.pi--disabled]="disabled()">
      <app-search-dropdown class="pi__code"
        [loadFn]="loadCodes"
        [pageSize]="500"
        [displayWith]="display"
        [compareWith]="compare"
        [clearable]="false"
        [searchable]="true"
        [disabled]="disabled()"
        [placeholder]="codePlaceholder()"
        [value]="selectedOption()"
        (valueChange)="onCodePicked($any($event))"/>
      <input type="tel" class="pi__number"
        [attr.id]="inputId() || null"
        aria-label="Phone number"
        [placeholder]="placeholder()"
        [disabled]="disabled()"
        [ngModel]="number()"
        (ngModelChange)="onNumberChange($event)"
        (blur)="onBlur()"/>
    </div>
  `,
  styles: [`
    .pi { display: flex; gap: 8px; align-items: stretch; }
    .pi__code { width: 130px; flex: 0 0 auto; }
    .pi__number {
      flex: 1; min-width: 0; padding: 9px 12px; border: 1px solid #d0d5dd; border-radius: 8px;
      font-size: 13.5px; color: #0f172a; font-family: inherit;
    }
    .pi__number:focus { outline: none; border-color: #2691a4; box-shadow: 0 0 0 3px rgba(38,145,164,.12); }
    .pi--disabled .pi__number { background: #f8fafc; color: #94a3b8; }
  `],
})
export class PhoneInputComponent implements ControlValueAccessor, OnInit, OnChanges {
  private countries = inject(CountriesService);
  private cdr = inject(ChangeDetectorRef);

  /** Dial code including the plus sign, e.g. "+973". */
  countryCode = model<string>('');
  /** National number as typed by the user. */
  number = model<string>('');
  disabledInput = input<boolean>(false, { alias: 'disabled' });
  placeholder = input<string>('123456789');
  codePlaceholder = input<string>('Code');
  /** id for the number input, so an external <label for> works. */
  inputId = input<string>('');
  /** Pre-selected code when the control value is empty (form-control mode). */
  defaultCountryCode = input<string>('');
  /** Emits when the field loses focus (for touched state on plain usage). */
  blurred = output<void>();

  private cvaDisabled = false;
  disabled = () => this.disabledInput() || this.cvaDisabled;

  options: DialOption[] = [];
  private lastWrittenValue = '';
  private hasWrittenValue = false;
  private onChange: (value: string) => void = () => {};
  private onTouched: () => void = () => {};

  async ngOnInit(): Promise<void> {
    try {
      this.options = this.buildOptions(await this.countries.load());
    } catch {
      this.options = [];
    }
    // A form value written before the list arrived could not be split yet.
    if (this.hasWrittenValue) this.applyValue(this.lastWrittenValue);
    this.cdr.markForCheck();
  }

  ngOnChanges(changes: SimpleChanges): void {
    // The default can arrive late (company settings still loading). Only apply
    // it while the field is untouched, never over a code or a number.
    if (changes['defaultCountryCode'] && !this.countryCode() && !this.number() && !this.lastWrittenValue) {
      this.countryCode.set(this.defaultCountryCode() || '');
    }
  }

  // ── dial-code dropdown ─────────────────────────────────────────────
  selectedOption = () => this.options.find(o => o.value === this.countryCode()) ?? (this.countryCode() ? { value: this.countryCode(), label: this.countryCode(), names: [] } : null);
  display = (o: DialOption) => o?.label ?? '';
  compare = (a: DialOption, b: DialOption) => a?.value === b?.value;

  /** Match by dial code or by any country name that uses it (legacy searchFn). */
  loadCodes = async (params: { page: number; pageSize: number; search: string }) => {
    const needle = params.search.trim().toLowerCase().replace(/^\+/, '');
    const items = !needle
      ? this.options
      : this.options.filter(o =>
          o.value.replace('+', '').startsWith(needle) || o.names.some(n => n.toLowerCase().includes(needle)));
    return { items, hasMore: false };
  };

  onCodePicked(option: DialOption | null): void {
    this.countryCode.set(option?.value ?? '');
    this.emitCombined();
  }

  onNumberChange(value: string): void {
    this.number.set(value ?? '');
    this.emitCombined();
  }

  onBlur(): void {
    this.onTouched();
    this.blurred.emit();
  }

  // ── ControlValueAccessor ───────────────────────────────────────────
  writeValue(value: string | null): void {
    this.hasWrittenValue = true;
    this.lastWrittenValue = value == null ? '' : String(value);
    this.applyValue(this.lastWrittenValue);
    this.cdr.markForCheck();
  }
  registerOnChange(fn: (value: string) => void): void { this.onChange = fn; }
  registerOnTouched(fn: () => void): void { this.onTouched = fn; }
  setDisabledState(isDisabled: boolean): void {
    this.cvaDisabled = isDisabled;
    this.cdr.markForCheck();
  }

  // ── internals ──────────────────────────────────────────────────────
  /** Combined value: nothing typed means empty (so `required` still fires). */
  private emitCombined(): void {
    const number = (this.number() || '').trim();
    const combined = number ? (this.countryCode() || '') + number : '';
    this.lastWrittenValue = combined;
    this.onChange(combined);
  }

  /** Split a stored string into dial code + number. */
  private applyValue(value: string): void {
    const raw = (value || '').trim();
    if (!raw) {
      this.countryCode.set(this.defaultCountryCode() || '');
      this.number.set('');
      return;
    }
    if (raw.startsWith('+')) {
      const compact = raw.replace(/[\s-]/g, '');
      const match = this.options
        .map(o => o.value)
        .filter(code => compact.startsWith(code))
        .sort((a, b) => b.length - a.length)[0];
      if (match) {
        this.countryCode.set(match);
        this.number.set(compact.slice(match.length));
        return;
      }
    }
    // Legacy number without a code (or a "+" value we cannot split yet).
    this.countryCode.set('');
    this.number.set(raw);
  }

  private buildOptions(countries: Country[]): DialOption[] {
    const byCode = new Map<string, DialOption>();
    for (const c of countries || []) {
      if (!c?.dial_code) continue;
      const existing = byCode.get(c.dial_code);
      if (existing) existing.names.push(c.name);
      else byCode.set(c.dial_code, { value: c.dial_code, label: c.dial_code, names: [c.name] });
    }
    return [...byCode.values()];
  }
}
