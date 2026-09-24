import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnDestroy,
  OnInit,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormControl, FormGroup, ReactiveFormsModule, ValidatorFn, Validators } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TranslateModule } from '@ngx-translate/core';

import { LanguageService } from '@core/i18n/language.service';
import { withTranslations } from '@core/i18n/with-translations';
import { DaySpan, TranslatedString } from '@features/promotions/models/common.model';
import { DaySpanControlComponent } from '@features/promotions/components/day-span-control/day-span-control.component';
import { TranslatedStringInputComponent } from '@features/promotions/components/translated-string-input/translated-string-input.component';

import { FieldTemplate } from '../../../../models/product-fields/field-template';
import {
  ProductPromotionSettings,
  ProductPromotionSettingsFields,
} from '../../../../models/product-promotion-settings.model';

/** Used when the caller does not pass a fields configuration. */
const DEFAULT_FIELD: FieldTemplate = { isVisible: true, isDisabled: false, isRequired: true };

interface PromotionLabels {
  name: string;
  amount: string;
  namePlaceholder: string;
  amountPlaceholder: string;
}

/** Wording used when the product type has no entry of its own. */
const DEFAULT_LABELS: PromotionLabels = {
  name: 'PRODUCTS.PROMOTION_NAME',
  amount: 'PRODUCTS.PROMOTION_AMOUNT',
  namePlaceholder: 'PRODUCTS.PROMOTION_FORM.ENTER_PROMOTION_NAME',
  amountPlaceholder: 'PRODUCTS.PROMOTION_FORM.ENTER_PROMOTION_AMOUNT',
};

/** Product types that name these fields after themselves. Add an entry per new type. */
const LABELS_BY_TYPE: Record<string, PromotionLabels> = {
  voucher: {
    name: 'PRODUCTS.VOUCHER_NAME',
    amount: 'PRODUCTS.VOUCHER_AMOUNT',
    namePlaceholder: 'PRODUCTS.PROMOTION_FORM.ENTER_VOUCHER_NAME',
    amountPlaceholder: 'PRODUCTS.PROMOTION_FORM.ENTER_VOUCHER_AMOUNT',
  },
};

/**
 * Promotion settings of a product (currently the voucher type). Ported from the
 * legacy `promotion-settings` component: the caller owns the model and the
 * form, this only edits them — `settings` is written in place and one control
 * per field (`<prefix>_<field>`) is registered on the host form so its
 * validity reaches the Save button, then removed again on destroy.
 * Legacy quirk kept as-is: the active/expiry periods and one-time-use block
 * follow the *amount* field's visibility, not their own flags.
 */
@Component({
  selector: 'app-pf-promotion-settings',
  standalone: true,
  imports: [
    CommonModule, ReactiveFormsModule, TranslateModule, DaySpanControlComponent,
    TranslatedStringInputComponent,
  ],
  templateUrl: './promotion-settings.component.html',
  styleUrl: './promotion-settings.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PromotionSettingsComponent implements OnInit, OnDestroy {
  private lang = inject(LanguageService);
  private destroyRef = inject(DestroyRef);

  /** Values being edited, written in place. */
  settings = input.required<ProductPromotionSettings>();
  /** Host form the controls are registered on. */
  form = input.required<FormGroup>();
  /** Visibility / disabled / required per field. */
  fields = input<ProductPromotionSettingsFields | undefined>(undefined);
  /** Keeps the control names unique inside the host form. */
  controlPrefix = input<string>('promotionSettings');
  /** Product type — picks the wording of the labels. */
  type = input<string>('');

  private readonly fieldNames = ['voucherName', 'initialVoucher', 'expiryPeriod', 'activePeriod', 'oneTimeUse', 'private'];

  /** Bumped on every edit so OnPush re-reads the in-place-mutated `settings`. */
  private tick = signal(0);
  private code = computed(() => this.lang.current() || 'en');

  labels = computed(() => LABELS_BY_TYPE[this.type()] ?? DEFAULT_LABELS);
  nameField = computed(() => this.fields()?.voucherName ?? DEFAULT_FIELD);
  amountField = computed(() => this.fields()?.initialVoucher ?? DEFAULT_FIELD);
  privateField = computed(() => this.fields()?.private ?? DEFAULT_FIELD);

  constructor() {
    withTranslations('promotions');
  }

  ngOnInit(): void {
    const s = this.settings();
    const f = this.fields();
    this.addControl('voucherName', this.nameField(), s.voucherName?.[this.code()] ?? '', []);
    this.addControl('initialVoucher', this.amountField(), s.initialVoucher, [Validators.min(0)]);
    this.addControl('expiryPeriod', f?.expiryPeriod ?? DEFAULT_FIELD, s.expiryPeriod?.value, [Validators.min(0)]);
    this.addControl('activePeriod', f?.activePeriod ?? DEFAULT_FIELD, s.activePeriod?.value, [Validators.min(0)]);
    this.addControl('oneTimeUse', f?.oneTimeUse ?? DEFAULT_FIELD, s.oneTimeUse);
    this.addControl('private', f?.private ?? DEFAULT_FIELD, s.private);

    // Mirror the plain controls back into the model (legacy used ngModel + formControlName).
    this.bind('initialVoucher', v => (this.settings().initialVoucher = v));
    this.bind('oneTimeUse', v => (this.settings().oneTimeUse = v));
    this.bind('private', v => (this.settings().private = v));
  }

  ngOnDestroy(): void {
    // The host form outlives this component — don't leave validators behind when the type changes.
    for (const field of this.fieldNames) {
      if (this.form().get(this.controlName(field))) {
        this.form().removeControl(this.controlName(field));
      }
    }
  }

  controlName(field: string): string {
    return `${this.controlPrefix()}_${field}`;
  }

  ctl(field: string): FormControl | null {
    return this.form().get(this.controlName(field)) as FormControl | null;
  }

  hasError(field: string, error: string): boolean {
    this.tick();
    return !!this.ctl(field)?.errors?.[error];
  }

  onName(value: TranslatedString): void {
    this.settings().voucherName = value;
    const c = this.ctl('voucherName');
    if (c) c.setValue(value?.[this.code()] ?? '');
    this.changed();
  }

  onPeriodChange(field: 'activePeriod' | 'expiryPeriod', span: DaySpan): void {
    this.settings()[field] = span;
    const control = this.ctl(field);
    if (control) {
      control.setValue(span.value);
      control.markAsDirty();
    }
    this.changed();
  }

  changed(): void {
    this.form().markAsDirty();
    this.tick.update(t => t + 1);
  }

  private bind(field: string, write: (v: any) => void): void {
    const c = this.ctl(field);
    c?.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(v => {
      write(v);
      this.changed();
    });
  }

  private addControl(field: string, options: FieldTemplate, defaultValue: any, validators: ValidatorFn[] = []): void {
    if (!options.isVisible) return;
    const all = options.isRequired ? [Validators.required, ...validators] : validators;
    this.form().addControl(
      this.controlName(field),
      new FormControl({ value: defaultValue ?? null, disabled: options.isDisabled }, all),
    );
  }
}
