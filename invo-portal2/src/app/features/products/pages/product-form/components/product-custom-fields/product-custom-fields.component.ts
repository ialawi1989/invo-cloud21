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
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
} from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TranslateModule } from '@ngx-translate/core';

import { ProductsService } from '../../../../services/products.service';
import { Product } from '../../../../models/product-form.model';
import { Fields } from '../../../../models/product-fields.model';

interface CustomFieldMeta {
  key:   string;
  label: string;
  type?: string; // 'text' | 'number' | 'boolean' | 'date' (extensible)
}

/**
 * product-custom-fields
 * ─────────────────────
 * Renders one control per entry in the company's custom-fields roster
 * (fetched via `ProductsService.getCustomFields`). Values are persisted
 * on `productInfo.customFields[<key>]` as a plain object map.
 */
@Component({
  selector: 'app-pf-product-custom-fields',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, TranslateModule],
  templateUrl: './product-custom-fields.component.html',
  styleUrl: './product-custom-fields.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProductCustomFieldsComponent implements OnInit {
  private fb = inject(FormBuilder);
  private destroyRef = inject(DestroyRef);
  private products = inject(ProductsService);

  productInfo   = input.required<Product>();
  productForm   = input.required<FormGroup>();
  fieldsOptions = input<Fields | null>(null);

  group!: FormGroup;
  metas = signal<CustomFieldMeta[]>([]);
  hasFields = computed<boolean>(() => this.metas().length > 0);

  async ngOnInit(): Promise<void> {
    // Initialise empty group so the template can bind immediately.
    this.group = this.fb.group({});
    this.productForm().setControl('customFields', this.group);

    const metas = await this.products.getCustomFields();
    this.metas.set(metas ?? []);

    const info = this.productInfo();
    if (!info.customFields || typeof info.customFields !== 'object') info.customFields = {};

    metas?.forEach((m) => {
      const initial = info.customFields[m.key];
      const coerced = this.coerce(initial, m.type);
      this.group.addControl(m.key, this.fb.control(coerced));
    });

    this.group.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((v) => {
        const p = this.productInfo();
        p.customFields = { ...p.customFields, ...v };
      });
  }

  private coerce(v: any, type?: string): any {
    if (type === 'number') return v == null || v === '' ? null : Number(v);
    if (type === 'boolean') return !!v;
    return v ?? '';
  }

  inputType(meta: CustomFieldMeta): string {
    switch (meta.type) {
      case 'number':  return 'number';
      case 'boolean': return 'checkbox';
      case 'date':    return 'date';
      default:        return 'text';
    }
  }
}
