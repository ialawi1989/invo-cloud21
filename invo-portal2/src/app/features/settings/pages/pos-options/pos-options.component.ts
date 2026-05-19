import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import {
  FormArray,
  FormBuilder,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
} from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

import { withTranslations } from '@core/i18n/with-translations';
import type { CanLeaveComponent } from '@core/guards/unsaved-changes.guard';
import { BreadcrumbsComponent } from '@shared/components/breadcrumbs/breadcrumbs.component';
import type { BreadcrumbItem } from '@shared/components/breadcrumbs/breadcrumbs.types';
import { LoadingOverlayComponent } from '@shared/components/spinner/loading-overlay.component';
import { FormStickyFooterComponent } from '@shared/components/form-sticky-footer/form-sticky-footer.component';
import { ToastService } from '@shared/components/toast/toast.service';
import { SearchDropdownComponent } from '@shared/components/dropdown/search-dropdown.component';
import { ToggleComponent } from '@shared/components/toggle/toggle.component';

import { BusinessSettingsService } from '../../services/business-settings.service';

/**
 * One toggle entry — drives the two grids of switches in the template
 * so we don't repeat the markup for every field.
 */
interface ToggleSpec {
  controlName: string;
  /** ngx-translate key for the label. */
  labelKey:    string;
  /** ngx-translate key for the helper hint. */
  hintKey:     string;
}

/** Specs for the "Point-of-Sale options" section. */
const POS_TOGGLES: readonly ToggleSpec[] = [
  { controlName: 'allowOnlyOneCashierPerTerminal', labelKey: 'SETTINGS.POS_OPTIONS.OPTIONS.ALLOW_ONLY_ONE_CASHIER',           hintKey: 'SETTINGS.POS_OPTIONS.OPTIONS.ALLOW_ONLY_ONE_CASHIER_HINT' },
  { controlName: 'noSaleWhenZero',                  labelKey: 'SETTINGS.POS_OPTIONS.OPTIONS.NO_SALE_WHEN_ZERO',                hintKey: 'SETTINGS.POS_OPTIONS.OPTIONS.NO_SALE_WHEN_ZERO_HINT' },
  { controlName: 'hideVoidedItem',                  labelKey: 'SETTINGS.POS_OPTIONS.OPTIONS.HIDE_VOIDED',                      hintKey: 'SETTINGS.POS_OPTIONS.OPTIONS.HIDE_VOIDED_HINT' },
  { controlName: 'voidedItemNeedExplanation',       labelKey: 'SETTINGS.POS_OPTIONS.OPTIONS.VOID_NEEDS_REASON',                hintKey: 'SETTINGS.POS_OPTIONS.OPTIONS.VOID_NEEDS_REASON_HINT' },
  { controlName: 'disableWaste',                    labelKey: 'SETTINGS.POS_OPTIONS.OPTIONS.DISABLE_WASTE',                    hintKey: 'SETTINGS.POS_OPTIONS.OPTIONS.DISABLE_WASTE_HINT' },
  { controlName: 'addCustomerByMSR',                labelKey: 'SETTINGS.POS_OPTIONS.OPTIONS.ADD_CUSTOMER_BY_MSR',              hintKey: 'SETTINGS.POS_OPTIONS.OPTIONS.ADD_CUSTOMER_BY_MSR_HINT' },
  { controlName: 'disableHalfItem',                 labelKey: 'SETTINGS.POS_OPTIONS.OPTIONS.DISABLE_HALF_ITEM',                hintKey: 'SETTINGS.POS_OPTIONS.OPTIONS.DISABLE_HALF_ITEM_HINT' },
  { controlName: 'showPrice',                       labelKey: 'SETTINGS.POS_OPTIONS.OPTIONS.SHOW_PRICE',                       hintKey: 'SETTINGS.POS_OPTIONS.OPTIONS.SHOW_PRICE_HINT' },
  { controlName: 'showQty',                         labelKey: 'SETTINGS.POS_OPTIONS.OPTIONS.SHOW_QTY',                         hintKey: 'SETTINGS.POS_OPTIONS.OPTIONS.SHOW_QTY_HINT' },
  { controlName: 'adjPriceNeedExplanation',         labelKey: 'SETTINGS.POS_OPTIONS.OPTIONS.ADJ_PRICE_NEEDS_REASON',           hintKey: 'SETTINGS.POS_OPTIONS.OPTIONS.ADJ_PRICE_NEEDS_REASON_HINT' },
  { controlName: 'customerIsRequiredInInvoice',     labelKey: 'SETTINGS.POS_OPTIONS.OPTIONS.CUSTOMER_REQUIRED_IN_INVOICE',     hintKey: 'SETTINGS.POS_OPTIONS.OPTIONS.CUSTOMER_REQUIRED_IN_INVOICE_HINT' },
  { controlName: 'instantSaveRetailOrder',          labelKey: 'SETTINGS.POS_OPTIONS.OPTIONS.INSTANT_SAVE_RETAIL_ORDER',        hintKey: 'SETTINGS.POS_OPTIONS.OPTIONS.INSTANT_SAVE_RETAIL_ORDER_HINT' },
];

/** Specs for the "Printing options" section. */
const PRINT_TOGGLES: readonly ToggleSpec[] = [
  { controlName: 'printReceiptOnSent',                labelKey: 'SETTINGS.POS_OPTIONS.PRINT.PRINT_ON_SENT',                  hintKey: 'SETTINGS.POS_OPTIONS.PRINT.PRINT_ON_SENT_HINT' },
  { controlName: 'printReceiptOnPaid',                labelKey: 'SETTINGS.POS_OPTIONS.PRINT.PRINT_ON_PAID',                  hintKey: 'SETTINGS.POS_OPTIONS.PRINT.PRINT_ON_PAID_HINT' },
  { controlName: 'printVoidedItems',                  labelKey: 'SETTINGS.POS_OPTIONS.PRINT.PRINT_VOIDED_ITEMS',             hintKey: 'SETTINGS.POS_OPTIONS.PRINT.PRINT_VOIDED_ITEMS_HINT' },
  { controlName: 'printVoidDetails',                  labelKey: 'SETTINGS.POS_OPTIONS.PRINT.PRINT_VOID_DETAILS',             hintKey: 'SETTINGS.POS_OPTIONS.PRINT.PRINT_VOID_DETAILS_HINT' },
  { controlName: 'printHoldStamp',                    labelKey: 'SETTINGS.POS_OPTIONS.PRINT.PRINT_HOLD_STAMP',               hintKey: 'SETTINGS.POS_OPTIONS.PRINT.PRINT_HOLD_STAMP_HINT' },
  { controlName: 'sortItemsByCategoryForKitchenPrint',labelKey: 'SETTINGS.POS_OPTIONS.PRINT.SORT_BY_CATEGORY_KITCHEN',       hintKey: 'SETTINGS.POS_OPTIONS.PRINT.SORT_BY_CATEGORY_KITCHEN_HINT' },
  { controlName: 'hideShortNoteInReceipt',            labelKey: 'SETTINGS.POS_OPTIONS.PRINT.HIDE_SHORT_NOTE',                hintKey: 'SETTINGS.POS_OPTIONS.PRINT.HIDE_SHORT_NOTE_HINT' },
  { controlName: 'printSecondLanguageInReceipt',      labelKey: 'SETTINGS.POS_OPTIONS.PRINT.SECOND_LANGUAGE',                hintKey: 'SETTINGS.POS_OPTIONS.PRINT.SECOND_LANGUAGE_HINT' },
  { controlName: 'groupItemsInReceipt',               labelKey: 'SETTINGS.POS_OPTIONS.PRINT.GROUP_ITEMS',                    hintKey: 'SETTINGS.POS_OPTIONS.PRINT.GROUP_ITEMS_HINT' },
];

/** Receipt-copies dropdown options (0..5). */
const RECEIPT_COPIES_OPTIONS: { label: string; value: number }[] =
  [0, 1, 2, 3, 4, 5].map((n) => ({ label: String(n), value: n }));

/**
 * Settings → POS Options
 * ──────────────────────
 * Edits the company-wide `Company.options.*` and `Company.printingOptions.*`
 * blobs that drive POS terminal behaviour: cashier enforcement, void/waste
 * flow, receipt printing, kitchen output. Saves through the same
 * `company/saveCompany` endpoint Business Settings uses.
 */
@Component({
  selector: 'app-pos-options',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    ReactiveFormsModule,
    TranslateModule,
    BreadcrumbsComponent,
    LoadingOverlayComponent,
    FormStickyFooterComponent,
    SearchDropdownComponent,
    ToggleComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './pos-options.component.html',
  styleUrl: './pos-options.component.scss',
})
export class PosOptionsComponent implements OnInit, CanLeaveComponent {
  private fb         = inject(FormBuilder);
  private service    = inject(BusinessSettingsService);
  private translate  = inject(TranslateService);
  private destroyRef = inject(DestroyRef);
  private router     = inject(Router);
  private toast      = inject(ToastService);

  loading = signal<boolean>(false);
  saving  = signal<boolean>(false);

  /** Loaded company snapshot — kept so save can merge our edits back in
   *  without dropping unrelated fields the backend stored. */
  private company = signal<any>(null);

  /** Re-translate computed labels when ngx-translate finishes loading. */
  private i18nTick = signal(0);

  // ─── Constants exposed to the template ─────────────────────────────────
  readonly posToggles    = POS_TOGGLES;
  readonly printToggles  = PRINT_TOGGLES;
  readonly receiptCopies = RECEIPT_COPIES_OPTIONS;

  // ─── Copies-dropdown adapters ──────────────────────────────────────────
  // `<app-search-dropdown>` swapped in for the legacy native `<select>` so
  // the look matches the rest of the page. Each adapter is bound by
  // reference so OnPush sees a stable input.
  copiesDisplay = (o: { label: string; value: number } | null) => o?.label ?? '';
  copiesCompare = (a: { value: number } | null, b: { value: number } | null) => (a?.value ?? -1) === (b?.value ?? -1);
  copiesToValue = (o: { value: number } | null) => o?.value ?? null;
  /** Look up the option entry for the form control's current value. */
  selectedCopies(controlName: string): { label: string; value: number } | null {
    const v = this.form.get(['printingOptions', controlName])?.value;
    return this.receiptCopies.find(o => o.value === v) ?? null;
  }
  /** Write the picked option back into the form. */
  setCopies(controlName: string, opt: { value: number } | null): void {
    this.form.get(['printingOptions', controlName])?.setValue(opt?.value ?? null);
  }

  // ─── Form ──────────────────────────────────────────────────────────────
  form: FormGroup = this.fb.group({
    options:         this.fb.group(this.buildToggleGroup(POS_TOGGLES, {
      maxReferneceNumber: [99],
      voidReasons:        this.fb.array([] as FormControl<string>[]),
    })),
    printingOptions: this.fb.group(this.buildToggleGroup(PRINT_TOGGLES, {
      numberOfReceiptWhenSent: [0],
      numberOfReceiptWhenPaid: [0],
      printVoidedItems:        [true], // legacy default
    })),
  });

  /** New-void-reason scratch input — kept outside the form. */
  voidReasonDraft = signal<string>('');

  /** Convenience accessors for the template. */
  optionsGroup  = this.form.get('options')         as FormGroup;
  printingGroup = this.form.get('printingOptions') as FormGroup;
  voidReasons   = this.optionsGroup.get('voidReasons') as FormArray<FormControl<string>>;

  // ─── Derived ───────────────────────────────────────────────────────────
  breadcrumbs = computed<BreadcrumbItem[]>(() => {
    this.i18nTick();
    return [
      { label: this.translate.instant('SETTINGS.TITLE'), routerLink: '/settings' },
      { label: this.translate.instant('SETTINGS.ITEMS.POS_OPTIONS') },
    ];
  });

  saveLabel = computed<string>(() => {
    this.i18nTick();
    return this.translate.instant('COMMON.SAVING');
  });

  constructor() {
    withTranslations('settings');
    this.translate.onTranslationChange
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.i18nTick.update((n) => n + 1));
    this.translate.onLangChange
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.i18nTick.update((n) => n + 1));
  }

  async ngOnInit(): Promise<void> {
    this.loading.set(true);
    try {
      const data = await this.service.getCompany();
      this.company.set(data ?? {});
      this.hydrate(data ?? {});
    } finally {
      this.loading.set(false);
    }
  }

  // ─── Void-reasons FormArray handling ───────────────────────────────────
  addVoidReason(): void {
    const value = this.voidReasonDraft().trim();
    if (!value) return;
    // Skip duplicates (case-insensitive) — they'd just be visual noise.
    const exists = this.voidReasons.controls.some(
      (c) => c.value.trim().toLowerCase() === value.toLowerCase(),
    );
    if (!exists) {
      this.voidReasons.push(this.fb.control(value, { nonNullable: true }));
      this.form.markAsDirty();
    }
    this.voidReasonDraft.set('');
  }

  removeVoidReason(index: number): void {
    this.voidReasons.removeAt(index);
    this.form.markAsDirty();
  }

  // ─── Save / cancel ─────────────────────────────────────────────────────
  async save(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.saving.set(true);
    try {
      const v = this.form.getRawValue() as {
        options: Record<string, unknown> & { voidReasons: string[] };
        printingOptions: Record<string, unknown>;
      };
      const merged = {
        ...(this.company() ?? {}),
        options:         { ...(this.company()?.options ?? {}),         ...v.options         },
        printingOptions: { ...(this.company()?.printingOptions ?? {}), ...v.printingOptions },
        // `voidReasons` lives at the company root in the legacy model —
        // mirror it so older readers still find it where they expect.
        voidReasons: v.options.voidReasons ?? [],
      };
      const res = await this.service.saveCompany(merged);
      if (res?.success) {
        this.company.set(merged);
        this.form.markAsPristine();
        this.toast.success('COMMON.SAVED_OK');
        this.router.navigate(['/settings']);
      } else {
        this.toast.error('COMMON.SAVE_FAILED');
      }
    } catch (e: any) {
      console.error('[pos-options] save failed', e);
      this.toast.error('COMMON.SAVE_FAILED', e?.message);
    } finally {
      this.saving.set(false);
    }
  }

  cancel(): void {
    this.router.navigate(['/settings']);
  }

  hasUnsavedChanges(): boolean {
    return this.form.dirty && !this.saving();
  }

  // ─── Internal ──────────────────────────────────────────────────────────
  /** Build a FormGroup config: `{ <toggle>: [false], …, <extra>: <ctrl> }`. */
  private buildToggleGroup(
    specs: readonly ToggleSpec[],
    extras: Record<string, unknown> = {},
  ): Record<string, unknown> {
    const cfg: Record<string, unknown> = {};
    for (const t of specs) cfg[t.controlName] = [false];
    Object.assign(cfg, extras);
    return cfg;
  }

  /** Patch the form from the loaded company payload, including void reasons. */
  private hydrate(c: any): void {
    const opts = c.options ?? {};
    const print = c.printingOptions ?? {};
    // Toggles
    for (const t of POS_TOGGLES)   this.form.get(['options', t.controlName])?.setValue(!!opts[t.controlName],   { emitEvent: false });
    for (const t of PRINT_TOGGLES) this.form.get(['printingOptions', t.controlName])?.setValue(!!print[t.controlName], { emitEvent: false });
    // Numbers
    this.form.get(['options', 'maxReferneceNumber'])?.setValue(num(opts.maxReferneceNumber, 99), { emitEvent: false });
    this.form.get(['printingOptions', 'numberOfReceiptWhenSent'])?.setValue(num(print.numberOfReceiptWhenSent, 0), { emitEvent: false });
    this.form.get(['printingOptions', 'numberOfReceiptWhenPaid'])?.setValue(num(print.numberOfReceiptWhenPaid, 0), { emitEvent: false });
    // `printVoidedItems` defaults to `true` if the company never set it.
    if (print.printVoidedItems == null) {
      this.form.get(['printingOptions', 'printVoidedItems'])?.setValue(true, { emitEvent: false });
    }
    // Void reasons (FormArray)
    while (this.voidReasons.length > 0) this.voidReasons.removeAt(0, { emitEvent: false });
    const reasons: string[] = Array.isArray(c.voidReasons) ? c.voidReasons : [];
    for (const r of reasons) {
      if (typeof r === 'string' && r.trim()) {
        this.voidReasons.push(this.fb.control(r, { nonNullable: true }), { emitEvent: false });
      }
    }
    this.form.markAsPristine();
  }
}

function num(v: unknown, fallback: number): number {
  if (v == null || v === '') return fallback;
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}
