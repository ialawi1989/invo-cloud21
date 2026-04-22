import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  inject,
  input,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

import { ProductsService } from '../../../../services/products.service';
import {
  productBarcodeUniqueValidator,
  productNameUniqueValidator,
} from '../../../../services/product-validators';
import { Product } from '../../../../models/product-form.model';
import { Fields } from '../../../../models/product-fields.model';
import { ModalService } from '@shared/modal';
import { TooltipDirective } from '@shared/directives/tooltip.directive';
import { RichEditorComponent } from '@shared/components/rich-editor/rich-editor.component';
import { TranslationModalComponent, TranslationModalData } from './translation-modal.component';

/**
 * common-fields
 * ─────────────
 * Name / Barcode / SKU / Description. Pure reactive forms.
 *
 * Registers a `common` FormGroup onto the parent `productForm`. One-way
 * sync on value changes keeps `productInfo` in sync so derived getters
 * (`checkNameIsEmpty`, etc.) continue to return fresh values. No ngModel.
 */
@Component({
  selector: 'app-pf-common-fields',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, TranslateModule, TooltipDirective, RichEditorComponent],
  templateUrl: './common-fields.component.html',
  styleUrl: './common-fields.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CommonFieldsComponent implements OnInit {
  private fb = inject(FormBuilder);
  private destroyRef = inject(DestroyRef);
  private productsService = inject(ProductsService);
  private modals = inject(ModalService);
  private translate = inject(TranslateService);

  productInfo   = input.required<Product>();
  productForm   = input.required<FormGroup>();
  fieldsOptions = input<Fields | null>(null);

  group!: FormGroup;

  ngOnInit(): void {
    const info = this.productInfo();
    const f = this.fieldsOptions();

    // Async uniqueness validators — fire 500ms after typing settles, skip
    // blank values, and pass the current product id so editing your own
    // record doesn't self-flag as a duplicate.
    const nameAsync = productNameUniqueValidator(this.productsService, {
      getProductId: () => this.productInfo().id,
      tableName: 'product',
    });
    const barcodeAsync = productBarcodeUniqueValidator(this.productsService, {
      getProductId: () => this.productInfo().id,
      getIsMatrix: () => !!this.productInfo().productMatrixId,
      tableName: 'product',
    });

    this.group = this.fb.group({
      name:        [info.name,
                    f?.name?.isRequired ? [Validators.required] : [],
                    [nameAsync]],
      barcode:     [info.barcode,
                    f?.barcode?.isRequired ? [Validators.required] : [],
                    [barcodeAsync]],
      sku:         [{ value: info.sku, disabled: !!info.productMatrixId },
                    f?.SKU?.isRequired ? [Validators.required] : []],
      description: [info.description, f?.description?.isRequired ? [Validators.required] : []],
    });

    this.productForm().setControl('common', this.group);

    // One-way sync: form → model so getters see fresh values.
    this.group.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((v) => {
        const p = this.productInfo();
        // Name goes through setNameWithSync to keep translations coherent.
        if (v.name !== p.name) {
          const lang = (localStorage.getItem('lang') === 'ar' ? 'ar' : 'en') as 'en' | 'ar';
          p.setNameWithSync(v.name ?? '', lang);
        }
        p.barcode     = v.barcode ?? '';
        p.sku         = v.sku ?? '';
        p.description = v.description ?? '';
      });
  }

  // Show Generate button when barcode is empty (mirrors old UX)
  get barcodeIsEmpty(): boolean {
    return !this.group.controls['barcode']?.value;
  }

  generateBarcode(): void {
    // Service returns a valid EAN-13 synchronously — see ProductCrudService.
    const code = this.productsService.generateRandomEan13();
    if (code) this.group.patchValue({ barcode: code });
  }

  c(name: 'name' | 'barcode' | 'sku' | 'description') {
    return this.group.controls[name];
  }

  showNameTranslation(): void {
    const p = this.productInfo();
    p.translation.name.en = p.name || p.translation.name.en;
    const ref = this.modals.open<TranslationModalComponent, TranslationModalData, { en: string; ar: string }>(
      TranslationModalComponent,
      {
        size: 'md',
        data: {
          title: this.translate.instant('PRODUCTS.ACTIONS.TRANSLATION'),
          value: { en: p.translation.name.en, ar: p.translation.name.ar },
        },
      },
    );
    ref.afterClosed().then((result) => {
      if (!result) return;
      p.translation.name.en = result.en;
      p.translation.name.ar = result.ar;
      p.name = result.en;
      this.group.patchValue({ name: result.en });
    });
  }

  showDescriptionTranslation(): void {
    const p = this.productInfo();
    p.translation.description.en = p.description || p.translation.description.en;
    const ref = this.modals.open<TranslationModalComponent, TranslationModalData, { en: string; ar: string }>(
      TranslationModalComponent,
      {
        size: 'md',
        data: {
          title: this.translate.instant('PRODUCTS.ACTIONS.TRANSLATION'),
          value: { en: p.translation.description.en, ar: p.translation.description.ar },
          rich: true, // description is now HTML
        },
      },
    );
    ref.afterClosed().then((result) => {
      if (!result) return;
      p.translation.description.en = result.en;
      p.translation.description.ar = result.ar;
      p.description = result.en;
      this.group.patchValue({ description: result.en });
    });
  }
}
