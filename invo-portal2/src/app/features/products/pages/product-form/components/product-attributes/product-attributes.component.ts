import {
  ChangeDetectionStrategy,
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
  FormArray,
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
} from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TranslateModule } from '@ngx-translate/core';

import { Product, ProductAttributes } from '../../../../models/product-form.model';
import { Fields } from '../../../../models/product-fields.model';

/**
 * Canonical roster of attributes that the old project seeded via
 * `setAttributes()`. If the backend doesn't return one of these, we inject
 * it unchecked so the user sees the full menu. Extra attributes from the
 * backend are kept and sorted after the canonical list.
 */
const CANONICAL_ATTRIBUTES: ReadonlyArray<{ key: string; title: string }> = [
  { key: 'halal',           title: 'Halal' },
  { key: 'vegan',           title: 'Vegan' },
  { key: 'spicy',           title: 'Spicy' },
  { key: 'very-spicy',      title: 'Very Spicy' },
  { key: 'organic',         title: 'Organic' },
  { key: 'fresh',           title: 'Fresh' },
  { key: 'angus-beaf',      title: 'Angus Beaf' },
  { key: 'sugar-free',      title: 'Sugar Free' },
  { key: 'no-sugar',        title: 'No Sugar added' },
  { key: 'lactose-free',    title: 'Lactose Free' },
  { key: 'keto',            title: 'Keto' },
  { key: 'gluten-free',     title: 'Gluten Free' },
  { key: 'trans-fat-free',  title: 'Trans Fat Free' },
  { key: 'contain-alcohol', title: 'Contain Alcohol' },
  { key: 'non-alcoholic',   title: 'Non Alcoholic' },
];

/**
 * product-attributes
 * ──────────────────
 * Flat list of named boolean attributes (e.g. "Halal", "Vegan", "Organic").
 * The attribute roster comes from the API on the product itself; we just
 * render checkboxes and maintain `checked` + `showInSearch` on each row.
 */
@Component({
  selector: 'app-pf-product-attributes',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, TranslateModule],
  templateUrl: './product-attributes.component.html',
  styleUrl: './product-attributes.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProductAttributesComponent implements OnInit {
  private fb = inject(FormBuilder);
  private destroyRef = inject(DestroyRef);

  productInfo   = input.required<Product>();
  productForm   = input.required<FormGroup>();
  fieldsOptions = input<Fields | null>(null);

  rows!: FormArray<FormGroup>;

  /** Debounced search term — filters which rows are rendered by title match. */
  search = signal<string>('');

  /** Bumped after seeding / toggles so the filtered-view computed re-runs. */
  private rowsTick = signal(0);

  /**
   * Rows visible in the tile grid. Applies the search filter and respects
   * the `showInSearch` flag from the old project (null / true → visible,
   * explicit false → hidden). Stays synced with the FormArray via rowsTick.
   */
  visibleRows = computed<{ index: number; group: FormGroup }[]>(() => {
    void this.rowsTick();
    if (!this.rows) return [];
    const term = this.search().trim().toLowerCase();
    return this.rows.controls
      .map((g, index) => ({ index, group: g as FormGroup }))
      .filter(({ group }) => {
        const v = group.value as any;
        if (term && !(v.title ?? '').toLowerCase().includes(term)) return false;
        return true;
      });
  });

  ngOnInit(): void {
    const info = this.productInfo();
    if (!Array.isArray(info.productAttributes)) info.productAttributes = [];

    // Seed the canonical 15 attributes (old project's `setAttributes()`).
    // Anything already on the backend stays; missing ones are added unchecked.
    for (const canon of CANONICAL_ATTRIBUTES) {
      if (!info.productAttributes.some((a: any) => a.key === canon.key)) {
        const seed = new ProductAttributes() as any;
        seed.key = canon.key;
        seed.title = canon.title;
        seed.checked = false;
        info.productAttributes.push(seed);
      }
    }

    this.rows = this.fb.array(
      info.productAttributes.map((a: any) => this.fb.group({
        key:          [a['key'] ?? ''],
        title:        [a['title'] ?? ''],
        checked:      [!!a.checked],
        showInSearch: [a.showInSearch ?? null],
      })),
    );
    this.productForm().setControl('productAttributes', this.rows);
    this.rowsTick.update(n => n + 1);

    this.rows.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        info.productAttributes = this.rows.controls.map((g) => {
          const v = g.getRawValue() as any;
          return Object.assign(new ProductAttributes(), v);
        });
        this.rowsTick.update(n => n + 1);
      });
  }

  /** Tile click toggles the `checked` control on the row. */
  toggle(index: number): void {
    const ctrl = this.rows.at(index).get('checked');
    if (!ctrl) return;
    ctrl.setValue(!ctrl.value);
  }

  /** Asset path for the attribute's icon. Falls back to a generic icon via
   *  `(error)` handler on the <img> element in the template. */
  iconFor(key: string): string {
    return `assets/images/product-attribute/${key}.png`;
  }

  /** Hide the <img> on load error so the tile shows the title-only layout. */
  onIconError(event: Event): void {
    (event.target as HTMLImageElement).style.visibility = 'hidden';
  }

  onSearchInput(value: string): void {
    this.search.set(value);
  }

  rowAt(i: number): FormGroup {
    return this.rows.at(i) as FormGroup;
  }
}
