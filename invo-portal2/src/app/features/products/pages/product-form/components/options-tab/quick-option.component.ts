import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormGroup, ReactiveFormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';

import { ModalService } from '@shared/modal/modal.service';

import { Product } from '../../../../models/product-form.model';
import { Fields } from '../../../../models/product-fields.model';
import {
  PickOptionModalComponent,
  PickOptionModalData,
  PickOptionResult,
  PickedOption,
} from './pick-option-modal.component';

interface QuickOptionRow {
  optionId: string;
  name:     string;
  qty:      number;
}

/**
 * Quick options sub-section for menuItem. Flat list — POS quick-add tiles.
 * Stored on `productInfo.quickOptions`. No qty editor, no drag-order.
 */
@Component({
  selector: 'app-pf-quick-option',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, TranslateModule],
  templateUrl: './quick-option.component.html',
  styleUrl: './quick-option.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class QuickOptionComponent {
  private modal = inject(ModalService);
  private cdr   = inject(ChangeDetectorRef);

  productInfo   = input.required<Product>();
  productForm   = input.required<FormGroup>();
  fieldsOptions = input<Fields | null>(null);

  search = signal<string>('');
  /** Bumped after every mutation so `rows` re-derives. The `productInfo`
   *  input signal doesn't track property mutations on its value. */
  private version = signal<number>(0);

  rows = computed<QuickOptionRow[]>(() => {
    void this.version();
    const list: any[] = (this.productInfo().quickOptions ?? []) as any[];
    const term = this.search().trim().toLowerCase();
    const mapped: QuickOptionRow[] = list.map((o: any) => ({
      optionId: o.optionId ?? o.id ?? '',
      name:     o.name ?? '',
      qty:      Number(o.qty ?? 1),
    }));
    if (!term) return mapped;
    return mapped.filter((r) => r.name.toLowerCase().includes(term));
  });

  setSearch(value: string): void {
    this.search.set(value);
  }

  clearSearch(): void {
    this.search.set('');
  }

  removeOption(optionId: string): void {
    const info = this.productInfo();
    if (!Array.isArray(info.quickOptions)) info.quickOptions = [];
    info.quickOptions = info.quickOptions.filter(
      (o: any) => (o.optionId ?? o.id) !== optionId,
    );
    this.productForm().markAsDirty();
    this.version.update((n) => n + 1);
    this.cdr.markForCheck();
  }

  async openPicker(): Promise<void> {
    const info = this.productInfo();
    if (!Array.isArray(info.quickOptions)) info.quickOptions = [];
    const existingIds = info.quickOptions
      .map((o: any) => o.optionId ?? o.id)
      .filter(Boolean);

    const ref = this.modal.open<PickOptionModalComponent, PickOptionModalData, PickOptionResult>(
      PickOptionModalComponent,
      {
        data: { excludedIds: existingIds, title: 'PRODUCTS.FORM.PICK_OPTIONS' },
        size: 'md',
      },
    );
    const result = await ref.afterClosed();
    if (!result) return;
    if (!result.added.length && !result.removed.length) return;

    if (result.removed.length) {
      const removeSet = new Set(result.removed);
      info.quickOptions = info.quickOptions.filter(
        (o: any) => !removeSet.has(o.optionId ?? o.id),
      );
    }
    result.added.forEach((p: PickedOption) => {
      info.quickOptions.push({
        optionId: p.id,
        name:     p.name,
        qty:      p.qty ?? 1,
      });
    });
    this.productForm().markAsDirty();
    this.version.update((n) => n + 1);
    this.cdr.markForCheck();
  }
}
