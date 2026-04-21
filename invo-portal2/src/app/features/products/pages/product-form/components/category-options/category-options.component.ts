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

  @ViewChild('categoryDropdown') categoryDropdown?: SearchDropdownComponent<DropdownItem>;

  loadDepartments: DropdownLoadFn<DropdownItem> = async ({ page, pageSize, search }) => {
    const res = await this.productsService.getDepartments({ page, pageSize, search });
    return { items: res.items as DropdownItem[], hasMore: res.hasMore } as DropdownLoadResult<DropdownItem>;
  };

  loadCategories: DropdownLoadFn<DropdownItem> = async ({ page, pageSize, search }) => {
    // Use a silent read of categoryVersion so the signal tracks refreshes.
    void this.categoryVersion();
    const depId = this.departmentId();
    if (!depId) return { items: [], hasMore: false };
    const res = await this.productsService.getCategories({ page, pageSize, search, departmentId: depId });
    return { items: res.items as DropdownItem[], hasMore: res.hasMore } as DropdownLoadResult<DropdownItem>;
  };

  loadBrands: DropdownLoadFn<DropdownItem> = async ({ page, pageSize, search }) => {
    const res = await this.productsService.getBrands({ page, pageSize, search });
    return { items: res.items as DropdownItem[], hasMore: res.hasMore } as DropdownLoadResult<DropdownItem>;
  };

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
  displayLabel = (item: any): string => item?.label ?? String(item ?? '');
  compareByValue = (a: any, b: any): boolean => (a?.value ?? a) === (b?.value ?? b);
}
