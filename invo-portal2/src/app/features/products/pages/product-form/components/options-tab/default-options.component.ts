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
import { CdkDragDrop, DragDropModule, moveItemInArray } from '@angular/cdk/drag-drop';

import { ModalService } from '@shared/modal/modal.service';

import { Product } from '../../../../models/product-form.model';
import { Fields } from '../../../../models/product-fields.model';
import {
  PickOptionModalComponent,
  PickOptionModalData,
  PickOptionResult,
  PickedOption,
} from './pick-option-modal.component';

interface DefaultOptionRow {
  optionId: string;
  name:     string;
  qty:      number;
  index:    number;
}

/**
 * Default options sub-section. Drag-orderable list with per-item qty —
 * options here are auto-applied when the menu item is added to a ticket.
 * Stored on `productInfo.defaultOptions` with the row order tracked by
 * `index`.
 */
@Component({
  selector: 'app-pf-default-options',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, TranslateModule, DragDropModule],
  templateUrl: './default-options.component.html',
  styleUrl: './default-options.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DefaultOptionsComponent {
  private modal = inject(ModalService);
  private cdr   = inject(ChangeDetectorRef);

  productInfo   = input.required<Product>();
  productForm   = input.required<FormGroup>();
  fieldsOptions = input<Fields | null>(null);

  search = signal<string>('');
  /** Bumped after every mutation (add/remove/qty/reorder) so `rows`
   *  re-derives from the underlying `productInfo.defaultOptions` array. */
  private version = signal<number>(0);

  rows = computed<DefaultOptionRow[]>(() => {
    void this.version();
    const list: any[] = (this.productInfo().defaultOptions ?? []) as any[];
    const term = this.search().trim().toLowerCase();
    const mapped: DefaultOptionRow[] = list.map((o: any, i: number) => ({
      optionId: o.optionId ?? o.id ?? '',
      name:     o.name ?? '',
      qty:      Number(o.qty ?? 1),
      index:    Number(o.index ?? i),
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

  setQty(optionId: string, raw: string): void {
    const info = this.productInfo();
    if (!Array.isArray(info.defaultOptions)) return;
    const idx = info.defaultOptions.findIndex((o: any) => (o.optionId ?? o.id) === optionId);
    if (idx < 0) return;
    const next = Number(raw);
    info.defaultOptions[idx].qty = Number.isFinite(next) && next >= 0 ? next : 0;
    this.productForm().markAsDirty();
    this.version.update((n) => n + 1);
  }

  removeOption(optionId: string): void {
    const info = this.productInfo();
    if (!Array.isArray(info.defaultOptions)) info.defaultOptions = [];
    info.defaultOptions = info.defaultOptions
      .filter((o: any) => (o.optionId ?? o.id) !== optionId)
      .map((o: any, i: number) => ({ ...o, index: i }));
    this.productForm().markAsDirty();
    this.version.update((n) => n + 1);
    this.cdr.markForCheck();
  }

  drop(event: CdkDragDrop<DefaultOptionRow[]>): void {
    if (event.previousIndex === event.currentIndex) return;
    const info = this.productInfo();
    if (!Array.isArray(info.defaultOptions)) return;
    // Reorder is suppressed while a search filter is active to avoid
    // moving items relative to a hidden subset of the list.
    if (this.search().trim()) return;
    moveItemInArray(info.defaultOptions, event.previousIndex, event.currentIndex);
    info.defaultOptions = info.defaultOptions.map((o: any, i: number) => ({ ...o, index: i }));
    this.productForm().markAsDirty();
    this.version.update((n) => n + 1);
    this.cdr.markForCheck();
  }

  async openPicker(): Promise<void> {
    const info = this.productInfo();
    if (!Array.isArray(info.defaultOptions)) info.defaultOptions = [];
    const existingIds = info.defaultOptions
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
      info.defaultOptions = info.defaultOptions.filter(
        (o: any) => !removeSet.has(o.optionId ?? o.id),
      );
    }
    result.added.forEach((p: PickedOption) => {
      info.defaultOptions.push({
        optionId: p.id,
        name:     p.name,
        qty:      p.qty ?? 1,
        index:    info.defaultOptions.length,
      });
    });
    info.defaultOptions = info.defaultOptions.map((o: any, i: number) => ({ ...o, index: i }));
    this.productForm().markAsDirty();
    this.version.update((n) => n + 1);
    this.cdr.markForCheck();
  }
}
