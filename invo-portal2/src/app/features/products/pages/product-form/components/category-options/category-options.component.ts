import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  ViewChild,
  inject,
  input,
  signal,
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
import { DropdownLoadFn, DropdownLoadResult } from '@shared/components/dropdown/search-dropdown.types';

import { ProductsService } from '../../../../services/products.service';
import { Product } from '../../../../models/product-form.model';
import { Fields } from '../../../../models/product-fields.model';

interface DropdownItem { label: string; value: string; }

/**
 * category-options
 * ────────────────
 * Department / Category / Brand pickers. Category is gated on Department
 * being chosen; changing Department clears Category. Pure reactive form.
 */
@Component({
  selector: 'app-pf-category-options',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, TranslateModule, SearchDropdownComponent],
  templateUrl: './category-options.component.html',
  styleUrl: './category-options.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CategoryOptionsComponent implements OnInit {
  private fb = inject(FormBuilder);
  private destroyRef = inject(DestroyRef);
  private productsService = inject(ProductsService);

  productInfo   = input.required<Product>();
  productForm   = input.required<FormGroup>();
  fieldsOptions = input<Fields | null>(null);

  group!: FormGroup;

  // Current department selection drives what the category loader queries.
  departmentId = signal<string | null>(null);
  // Bump this to force the SearchDropdown to re-fetch from page 1.
  private categoryVersion = signal(0);

  /**
   * Caches of the most recently-seen dropdown rows — populated on every
   * `loadFn` call. Used by `displayLabel` to resolve a bare UUID stored
   * in the form control back to a human-readable label, so the trigger
   * doesn't show the raw id on edit-mode first paint.
   */
  private departmentsCache = signal<DropdownItem[]>([]);
  private categoriesCache  = signal<DropdownItem[]>([]);
  private brandsCache      = signal<DropdownItem[]>([]);

  @ViewChild('categoryDropdown') categoryDropdown?: SearchDropdownComponent<DropdownItem>;

  loadDepartments: DropdownLoadFn<DropdownItem> = async ({ page, pageSize, search }) => {
    const departmentId = (this.group?.get('departmentId')?.value as string | null) ?? null;
    const res = await this.productsService.getDepartments({ page, pageSize, search, departmentId });
    const items = res.items as DropdownItem[];
    this.mergeCache(this.departmentsCache, items, page === 1);
    return { items, hasMore: res.hasMore } as DropdownLoadResult<DropdownItem>;
  };

  loadCategories: DropdownLoadFn<DropdownItem> = async ({ page, pageSize, search }) => {
    // Use a silent read of categoryVersion so the signal tracks refreshes.
    void this.categoryVersion();
    const depId = this.departmentId();
    if (!depId) return { items: [], hasMore: false };
    const categoryId = (this.group?.get('categoryId')?.value as string | null) ?? null;
    const res = await this.productsService.getCategories({ page, pageSize, search, departmentId: depId, categoryId });
    const items = res.items as DropdownItem[];
    this.mergeCache(this.categoriesCache, items, page === 1);
    return { items, hasMore: res.hasMore } as DropdownLoadResult<DropdownItem>;
  };

  loadBrands: DropdownLoadFn<DropdownItem> = async ({ page, pageSize, search }) => {
    const brandId = (this.group?.get('brandId')?.value as string | null) ?? null;
    const res = await this.productsService.getBrands({ page, pageSize, search, brandId });
    const items = res.items as DropdownItem[];
    this.mergeCache(this.brandsCache, items, page === 1);
    return { items, hasMore: res.hasMore } as DropdownLoadResult<DropdownItem>;
  };

  private mergeCache(cache: ReturnType<typeof signal<DropdownItem[]>>, items: DropdownItem[], replace: boolean): void {
    if (replace) cache.set([...items]);
    else {
      const existing = new Set(cache().map(i => i.value));
      cache.update(cur => [...cur, ...items.filter(i => !existing.has(i.value))]);
    }
  }

  ngOnInit(): void {
    const info = this.productInfo();
    const f = this.fieldsOptions();

    this.group = this.fb.group({
      departmentId: [info.departmentId ?? null, f?.department?.isRequired ? [Validators.required] : []],
      categoryId:   [info.categoryId ?? null,   f?.category?.isRequired   ? [Validators.required] : []],
      brandId:      [info.brandid ?? null,      f?.brand?.isRequired      ? [Validators.required] : []],
    });

    this.productForm().setControl('category', this.group);
    this.departmentId.set(info.departmentId ?? null);

    // Optimistic seed from productInfo's denormalised names — keeps the
    // trigger showing a label for the split-second before the init fetches
    // resolve, instead of flashing the raw UUID.
    if (info.departmentId && info.departmentName) {
      this.departmentsCache.set([{ label: info.departmentName, value: info.departmentId }]);
    }
    if (info.categoryId && info.categoryName) {
      this.categoriesCache.set([{ label: info.categoryName, value: info.categoryId }]);
    }

    // When any of Department / Category / Brand already has a selected value,
    // fire a page-1 load on init so the backend can pin the selected row to
    // the top of the list and the cache has its canonical label ready — even
    // if the denormalised name on `productInfo` was missing or stale.
    if (info.departmentId) {
      this.productsService.getDepartments({
        page: 1, pageSize: 20, search: '', departmentId: info.departmentId,
      })
        .then((res) => this.mergeCache(this.departmentsCache, res.items as DropdownItem[], true))
        .catch(() => void 0);
    }
    if (info.categoryId && info.departmentId) {
      this.productsService.getCategories({
        page: 1, pageSize: 20, search: '',
        departmentId: info.departmentId, categoryId: info.categoryId,
      })
        .then((res) => this.mergeCache(this.categoriesCache, res.items as DropdownItem[], true))
        .catch(() => void 0);
    }
    if (info.brandid) {
      this.productsService.getBrands({
        page: 1, pageSize: 20, search: '', brandId: info.brandid,
      })
        .then((res) => this.mergeCache(this.brandsCache, res.items as DropdownItem[], true))
        .catch(() => void 0);
    }

    // Clear category when department changes.
    this.group.controls['departmentId'].valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((depId: string | null) => {
        const prev = this.departmentId();
        this.departmentId.set(depId ?? null);
        if (depId !== prev) {
          this.group.patchValue({ categoryId: null }, { emitEvent: false });
          this.categoryVersion.update((n) => n + 1);
        }
      });

    this.group.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((v) => {
        const p = this.productInfo();
        p.departmentId = v.departmentId ?? null;
        p.categoryId   = v.categoryId ?? null;
        p.brandid      = v.brandId ?? '';
      });
  }

  c(name: 'departmentId' | 'categoryId' | 'brandId') {
    return this.group.controls[name];
  }

  // Angular template parser can't evaluate inline arrows — bind these methods.
  displayLabel = (item: any): string => {
    if (item?.label) return item.label;
    if (typeof item === 'string' && item) {
      // Resolve a bare UUID from one of our caches so the trigger shows the
      // department/category/brand name instead of the raw id on edit-mode
      // first paint.
      const hit =
        this.departmentsCache().find(d => d.value === item) ||
        this.categoriesCache().find(c => c.value === item) ||
        this.brandsCache().find(b => b.value === item);
      if (hit?.label) return hit.label;
    }
    return String(item ?? '');
  };
  compareByValue = (a: any, b: any): boolean => (a?.value ?? a) === (b?.value ?? b);
}
