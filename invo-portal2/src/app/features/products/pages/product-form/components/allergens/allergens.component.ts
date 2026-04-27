import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  DestroyRef,
  OnInit,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  FormBuilder,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
} from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TranslateModule } from '@ngx-translate/core';

import { Product, Allergens } from '../../../../models/product-form.model';
import { Fields } from '../../../../models/product-fields.model';

interface AllergenDef {
  key:   string;
  title: string;
}

/**
 * Canonical allergen list — the FDA "big 9" plus the generic "Wheat /
 * Gluten" pairing the front-of-pack mockup uses. Adding a new allergen
 * here is enough; it'll appear in both Contains and May-Contain grids.
 */
const ALLERGEN_KEYS: ReadonlyArray<AllergenDef> = [
  { key: 'tree-nuts',    title: 'Tree Nuts' },
  { key: 'peanuts',      title: 'Peanuts' },
  { key: 'milk-dairy',   title: 'Milk/Dairy' },
  { key: 'eggs',         title: 'Eggs' },
  { key: 'wheat-gluten', title: 'Wheat/Gluten' },
  { key: 'soy',          title: 'Soy' },
  { key: 'fish',         title: 'Fish' },
  { key: 'shellfish',    title: 'Shellfish' },
  { key: 'sesame',       title: 'Sesame' },
];

/**
 * allergens
 * ─────────
 * Two parallel toggle grids ("Contains" / "May Contain") sharing the same
 * canonical allergen roster, plus a free-form Allergen Statement
 * textarea for facility / cross-contamination boilerplate.
 *
 * Both toggle sets and the statement persist on `productInfo.allergens`
 * (`Allergens` class). The textarea is fully user-editable — there's no
 * auto-generation from the toggles, so a custom statement isn't lost when
 * boxes change.
 */
@Component({
  selector: 'app-pf-allergens',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, TranslateModule],
  templateUrl: './allergens.component.html',
  styleUrl: './allergens.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AllergensComponent implements OnInit {
  private fb = inject(FormBuilder);
  private destroyRef = inject(DestroyRef);
  private cdr = inject(ChangeDetectorRef);

  productInfo   = input.required<Product>();
  productForm   = input.required<FormGroup>();
  fieldsOptions = input<Fields | null>(null);

  /** The canonical allergen list — exposed so the template can iterate
   *  it without re-declaring it. */
  readonly allergens: ReadonlyArray<AllergenDef> = ALLERGEN_KEYS;

  /** Current state of each toggle as Sets — bumped on every mutation
   *  so the template's `isContained` / `isMayContain` stay reactive. */
  private contains   = signal<Set<string>>(new Set());
  private mayContain = signal<Set<string>>(new Set());

  group!: FormGroup;
  statement = new FormControl<string>('', { nonNullable: true });

  isContained  = computed(() => (key: string) => this.contains().has(key));
  isMayContain = computed(() => (key: string) => this.mayContain().has(key));

  ngOnInit(): void {
    const info = this.productInfo();
    if (!info.allergens) info.allergens = new Allergens();
    const a = info.allergens;

    this.contains.set(new Set(a.contains ?? []));
    this.mayContain.set(new Set(a.mayContain ?? []));
    this.statement.setValue(a.statement ?? '');

    // Wrap our state in a FormGroup so the parent form sees it under
    // `allergens` and the dirty-tracking / validation pipeline picks it
    // up alongside everything else.
    this.group = this.fb.group({ statement: this.statement });
    this.productForm().setControl('allergens', this.group);

    this.statement.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((v) => {
        info.allergens.statement = v ?? '';
        this.productForm().markAsDirty();
      });
  }

  toggleContains(key: string): void {
    this.contains.update((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
    this.persist();
  }

  toggleMayContain(key: string): void {
    this.mayContain.update((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
    this.persist();
  }

  private persist(): void {
    const info = this.productInfo();
    info.allergens.contains   = [...this.contains()];
    info.allergens.mayContain = [...this.mayContain()];
    this.productForm().markAsDirty();
    this.cdr.markForCheck();
  }
}
