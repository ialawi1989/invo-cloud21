import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  computed,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TranslateModule } from '@ngx-translate/core';

import { SearchDropdownComponent } from '@shared/components/dropdown/search-dropdown.component';

import { Product } from '../../../../models/product-form.model';
import { Fields } from '../../../../models/product-fields.model';

interface UomItem { label: string; value: string; }

/**
 * kit-details
 * ───────────
 * Companion card for the `kit` product type — owns the kit's own UOM and the
 * "Exclude Inventory Deduction" channel toggles. Sits next to `kit-builder`
 * (which owns the components list). Mirrors the old project's split between
 * `kit-details` and `kit-builder` cards.
 */
@Component({
  selector: 'app-pf-kit-details',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, TranslateModule, SearchDropdownComponent],
  templateUrl: './kit-details.component.html',
  styleUrl: './kit-details.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class KitDetailsComponent implements OnInit {
  private fb = inject(FormBuilder);
  private destroyRef = inject(DestroyRef);

  productInfo   = input.required<Product>();
  productForm   = input.required<FormGroup>();
  fieldsOptions = input<Fields | null>(null);

  group!: FormGroup;

  /** UOM options — signal so user-typed entries can be appended at runtime. */
  uomOptions = signal<UomItem[]>([
    { label: 'Kg',     value: 'Kg' },
    { label: 'gram',   value: 'gram' },
    { label: 'Litre',  value: 'Litre' },
    { label: 'Galone', value: 'Galone' },
    { label: 'Ounce',  value: 'Ounce' },
    { label: 'Quart',  value: 'Quart' },
    { label: 'CTN',    value: 'CTN' },
    { label: 'BAG',    value: 'BAG' },
    { label: 'BUNDLE', value: 'BUNDLE' },
    { label: 'Pcs',    value: 'Pcs' },
  ]);

  /** Live search term inside the UOM dropdown — drives the "+ Create" footer. */
  uomSearchTerm = signal<string>('');

  /** Reference to the rendered dropdown so we can `close()` after creating. */
  uomDropdown = viewChild<SearchDropdownComponent<UomItem>>('uomDropdown');

  /** True when the typed term is non-empty AND not already in the option list
   *  (case-insensitive on `value`). */
  canCreateTypedUom = computed<boolean>(() => {
    const q = this.uomSearchTerm().trim();
    if (!q) return false;
    const exists = this.uomOptions().some((o) => o.value.toLowerCase() === q.toLowerCase());
    return !exists;
  });

  /** Footer "+ Create" — appends a new option, selects it, closes the panel.
   *  Stores the plain string value on the form (not the `{label,value}`
   *  object) — that's the shape the model and backend expect. */
  addCustomUom(raw: string): void {
    const v = raw?.trim();
    if (!v) return;
    if (!this.uomOptions().some((o) => o.value.toLowerCase() === v.toLowerCase())) {
      this.uomOptions.update((cur) => [...cur, { label: v, value: v }]);
    }
    this.group.patchValue({ UOM: v });
    this.productForm().markAsDirty();
    this.uomSearchTerm.set('');
    this.uomDropdown()?.close();
  }

  /** Bridge for `[toValue]` — persists just the string value on the form. */
  uomToValue = (item: UomItem | string): string =>
    typeof item === 'string' ? item : item?.value ?? '';

  readonly deductionSources: string[] = [
    'DineIn', 'Delivery', 'CarHop', 'Salon', 'Retail', 'TakeAway', 'Web', 'POS',
  ];
  readonly DEDUCTION_COLLAPSED_COUNT = 6;
  showAllDeductions = signal<boolean>(false);

  visibleDeductionSources = computed<string[]>(() => {
    const all = this.deductionSources;
    return this.showAllDeductions() ? all : all.slice(0, this.DEDUCTION_COLLAPSED_COUNT);
  });

  toggleDeductionSource(source: string, checked: boolean): void {
    const p = this.productInfo();
    const set = new Set(p.productDeduction ?? []);
    if (checked) set.add(source);
    else         set.delete(source);
    p.productDeduction = Array.from(set);
    this.productForm().markAsDirty();
  }

  isDeductionChecked(source: string): boolean {
    return (this.productInfo().productDeduction ?? []).includes(source);
  }

  ngOnInit(): void {
    const info = this.productInfo();
    const kd = this.fieldsOptions()?.kitDetails;

    this.group = this.fb.group({
      UOM: [info.UOM ?? '',
            kd?.UOM?.isRequired ? [Validators.required] : []],
    });
    this.productForm().setControl('kitDetails', this.group);

    this.group.controls['UOM'].valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((uom: string) => { info.UOM = uom ?? ''; });
  }

  c(name: 'UOM') { return this.group.controls[name]; }

  uomDisplay     = (v: UomItem | string): string => (typeof v === 'string' ? v : v?.label ?? '');
  compareByValue = (a: any, b: any): boolean      => (a?.value ?? a) === (b?.value ?? b);
}
