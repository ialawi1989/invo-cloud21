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
  PickOptionGroupModalComponent,
  PickOptionGroupModalData,
  PickOptionGroupResult,
  PickedOptionGroup,
} from './pick-option-group-modal.component';

interface OptionGroupRow {
  optionGroupId: string;
  title:         string;
  index:         number;
}

/**
 * Option groups sub-section. Drag-orderable list of references to
 * pre-defined option groups (e.g. "Sauce", "Meat"). Each row stores only
 * the group id + title cache; min/max selection rules live on the
 * OptionGroup itself, not the product.
 */
@Component({
  selector: 'app-pf-option-group',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, TranslateModule, DragDropModule],
  templateUrl: './option-group.component.html',
  styleUrl: './option-group.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OptionGroupComponent {
  private modal = inject(ModalService);
  private cdr   = inject(ChangeDetectorRef);

  productInfo   = input.required<Product>();
  productForm   = input.required<FormGroup>();
  fieldsOptions = input<Fields | null>(null);

  search = signal<string>('');
  private version = signal<number>(0);

  rows = computed<OptionGroupRow[]>(() => {
    void this.version();
    const list: any[] = (this.productInfo().optionGroups ?? []) as any[];
    const term = this.search().trim().toLowerCase();
    const mapped: OptionGroupRow[] = list.map((o: any, i: number) => ({
      optionGroupId: o.optionGroupId ?? o.id ?? '',
      title:         o.title ?? '',
      index:         Number(o.index ?? i),
    }));
    if (!term) return mapped;
    return mapped.filter((r) => r.title.toLowerCase().includes(term));
  });

  setSearch(value: string): void {
    this.search.set(value);
  }

  clearSearch(): void {
    this.search.set('');
  }

  removeGroup(id: string): void {
    const info = this.productInfo();
    if (!Array.isArray(info.optionGroups)) info.optionGroups = [];
    info.optionGroups = info.optionGroups
      .filter((o: any) => (o.optionGroupId ?? o.id) !== id)
      .map((o: any, i: number) => ({ ...o, index: i }));
    this.productForm().markAsDirty();
    this.version.update((n) => n + 1);
    this.cdr.markForCheck();
  }

  drop(event: CdkDragDrop<OptionGroupRow[]>): void {
    if (event.previousIndex === event.currentIndex) return;
    const info = this.productInfo();
    if (!Array.isArray(info.optionGroups)) return;
    if (this.search().trim()) return;
    moveItemInArray(info.optionGroups, event.previousIndex, event.currentIndex);
    info.optionGroups = info.optionGroups.map((o: any, i: number) => ({ ...o, index: i }));
    this.productForm().markAsDirty();
    this.version.update((n) => n + 1);
    this.cdr.markForCheck();
  }

  async openPicker(): Promise<void> {
    const info = this.productInfo();
    if (!Array.isArray(info.optionGroups)) info.optionGroups = [];
    const existingIds = info.optionGroups
      .map((o: any) => o.optionGroupId ?? o.id)
      .filter(Boolean);

    const ref = this.modal.open<
      PickOptionGroupModalComponent,
      PickOptionGroupModalData,
      PickOptionGroupResult
    >(PickOptionGroupModalComponent, {
      data: { excludedIds: existingIds, title: 'PRODUCTS.FORM.PICK_OPTION_GROUPS' },
      size: 'md',
    });
    const result = await ref.afterClosed();
    if (!result) return;
    if (!result.added.length && !result.removed.length) return;

    if (result.removed.length) {
      const removeSet = new Set(result.removed);
      info.optionGroups = info.optionGroups.filter(
        (o: any) => !removeSet.has(o.optionGroupId ?? o.id),
      );
    }
    result.added.forEach((p: PickedOptionGroup) => {
      info.optionGroups.push({
        optionGroupId: p.id,
        title:         p.title,
        index:         info.optionGroups.length,
      });
    });
    info.optionGroups = info.optionGroups.map((o: any, i: number) => ({ ...o, index: i }));
    this.productForm().markAsDirty();
    this.version.update((n) => n + 1);
    this.cdr.markForCheck();
  }
}
