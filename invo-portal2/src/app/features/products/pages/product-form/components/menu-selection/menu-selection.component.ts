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
  AbstractControl,
  FormArray,
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  ValidationErrors,
  ValidatorFn,
  Validators,
} from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TranslateModule } from '@ngx-translate/core';
import { CdkDragDrop, DragDropModule, moveItemInArray } from '@angular/cdk/drag-drop';

import { ModalService } from '@shared/modal/modal.service';

import { Product, SelectionItem } from '../../../../models/product-form.model';

/**
 * Each level must hold at least `noOfSelection` items — otherwise the
 * customer can't make a valid pick at that level. Sets `tooFewItems` on
 * the level FormGroup with `{ required, current }` so the panel can
 * surface the deficit, and `countInvalid()` in product-form picks it up.
 */
const levelMinItemsValidator: ValidatorFn = (group: AbstractControl): ValidationErrors | null => {
  const required = Number(group.get('noOfSelection')?.value ?? 0);
  const items    = group.get('items') as FormArray | null;
  const current  = items?.length ?? 0;
  if (required > 0 && current < required) {
    return { tooFewItems: { required, current } };
  }
  return null;
};
import { Fields } from '../../../../models/product-fields.model';
import {
  PickProductModalComponent,
  PickProductModalData,
  PickedProduct,
  PickProductResult,
} from '../pick-product-modal/pick-product-modal.component';

/**
 * menu-selection
 * ──────────────
 * "Build a meal" editor — a list of ordered **levels** (e.g. "Drink — pick
 * 1", "Sides — pick 2"). Mirrors the old InvoCloudFront2 layout:
 *
 *   • View mode (default)   — vertical pill nav on the left, the active
 *                             level's items on the right; one shared
 *                             "Pick Items" button feeds the active level.
 *   • Manage mode           — flat list of the levels themselves with
 *                             editable name + picks count and drag-handle
 *                             reordering. Toggle via the Manage / Done
 *                             button.
 *
 * Items inside a level can be drag-reordered in view mode. Pricing on the
 * parent product still derives from `Product.totalPrice()` which reads
 * `info.selection`; we just own the editor.
 */
@Component({
  selector: 'app-pf-menu-selection',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, TranslateModule, DragDropModule],
  templateUrl: './menu-selection.component.html',
  styleUrl: './menu-selection.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MenuSelectionComponent implements OnInit {
  private fb = inject(FormBuilder);
  private destroyRef = inject(DestroyRef);
  private modal = inject(ModalService);
  private cdr = inject(ChangeDetectorRef);

  productInfo   = input.required<Product>();
  productForm   = input.required<FormGroup>();
  fieldsOptions = input<Fields | null>(null);

  levels!: FormArray<FormGroup>;

  /** Bumped on every level mutation so the total recomputes. The
   *  `productInfo` input signal can't track property mutations on the
   *  Product instance, so we need an explicit reactive trigger. */
  private levelsVersion = signal<number>(0);

  /** Index of the currently visible level. */
  activeLevel = signal<number>(0);

  totalFromLowestSelections = computed<number>(() => {
    this.levelsVersion();
    return this.productInfo().totalPrice();
  });

  /** True when the field config marks this section as required and the
   *  user hasn't added any levels yet — drives the "Required" pill on the
   *  card title and the error styling on the zero-state. */
  isRequiredEmpty = computed<boolean>(() => {
    this.levelsVersion();
    return !!this.fieldsOptions()?.menuSelection?.isRequired
      && (this.levels?.length ?? 0) === 0;
  });

  ngOnInit(): void {
    const info = this.productInfo();
    if (!Array.isArray(info.selection)) info.selection = [];

    this.levels = this.fb.array(info.selection.map((s) => this.buildLevel(s)));
    // A menuSelection product is defined by its choice levels; saving with
    // zero levels makes the product unusable, so attach a `required` error
    // on the FormArray when the field config says it's required. Mirrors
    // the kit-builder / package-builder behaviour.
    if (this.fieldsOptions()?.menuSelection?.isRequired) {
      this.levels.addValidators((arr) =>
        (arr.value?.length ?? 0) === 0 ? { required: true } : null,
      );
      this.levels.updateValueAndValidity({ emitEvent: false });
    }
    this.productForm().setControl('selection', this.levels);
    if (this.levels.length > 0) this.activeLevel.set(0);

    this.levels.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.syncBackToModel();
        this.levelsVersion.update((n) => n + 1);
      });
  }

  // ─── FormGroup builders ──────────────────────────────────────────────
  private buildLevel(s: SelectionItem): FormGroup {
    const items = this.fb.array(
      (s.items ?? []).map((it: any) => this.buildItemRow(it)),
    );
    return this.fb.group({
      name:          [s['name'] ?? '', [Validators.required]],
      noOfSelection: [s.noOfSelection ?? 1, [Validators.required, Validators.min(1)]],
      items,
    }, { validators: levelMinItemsValidator });
  }

  private buildItemRow(it: any): FormGroup {
    // Accept legacy `id` from records persisted before the rename so old
    // menu-selection products still load; write back as `productId` only.
    return this.fb.group({
      productId:    [it.productId ?? it.id ?? ''],
      name:         [it.name ?? ''],
      defaultPrice: [it.defaultPrice ?? 0, [Validators.min(0)]],
      UOM:          [it.UOM ?? ''],
    });
  }

  private syncBackToModel(): void {
    const info = this.productInfo();
    // Re-stamp `index` based on current FormArray position on every sync.
    // Levels and items can be reordered by drag, added, or removed — keeping
    // indices in lock-step with array order means the backend gets a
    // self-consistent payload regardless of how the user got there.
    info.selection = this.levels.controls.map((level, levelIdx) => {
      const v = level.getRawValue() as any;
      return {
        name:          v.name ?? '',
        noOfSelection: Number(v.noOfSelection ?? 1),
        index:         levelIdx,
        items:         (v.items ?? []).map((it: any, itemIdx: number) => ({
          productId:    it.productId,
          name:         it.name,
          defaultPrice: Number(it.defaultPrice ?? 0),
          UOM:          it.UOM ?? '',
          index:        itemIdx,
        })),
      } as SelectionItem;
    });
  }

  // ─── Level operations ────────────────────────────────────────────────
  addLevel(): void {
    const idx = this.levels.length;
    this.levels.push(this.buildLevel({
      name:          `Level ${idx + 1}`,
      noOfSelection: 1,
      items:         [],
    } as any));
    this.activeLevel.set(idx);
    this.productForm().markAsDirty();
    this.cdr.markForCheck();
  }

  removeLevel(i: number): void {
    if (i < 0 || i >= this.levels.length) return;
    this.levels.removeAt(i);
    // Clamp active index if the removed level was the one in view.
    const last = Math.max(this.levels.length - 1, 0);
    if (this.activeLevel() > last) this.activeLevel.set(last);
    else if (this.activeLevel() === i) this.activeLevel.set(Math.max(i - 1, 0));
    this.productForm().markAsDirty();
    this.cdr.markForCheck();
  }

  dropLevel(event: CdkDragDrop<FormGroup[]>): void {
    if (event.previousIndex === event.currentIndex) return;
    // Snapshot the controls into a fresh array — `levels.controls` is the
    // same reference the FormArray uses internally, so mutating it via
    // `removeAt` below would also empty our local copy.
    const snapshot = [...this.levels.controls];
    moveItemInArray(snapshot, event.previousIndex, event.currentIndex);
    while (this.levels.length > 0) this.levels.removeAt(0, { emitEvent: false });
    snapshot.forEach((g) => this.levels.push(g, { emitEvent: false }));
    this.levels.updateValueAndValidity();
    // If the user drags the active level, follow it so view mode stays
    // pointing at "the same" level after the reorder.
    if (this.activeLevel() === event.previousIndex) {
      this.activeLevel.set(event.currentIndex);
    }
    this.productForm().markAsDirty();
    this.cdr.markForCheck();
  }

  setActiveLevel(i: number): void {
    if (i < 0 || i >= this.levels.length) return;
    this.activeLevel.set(i);
  }

  levelAt(i: number): FormGroup {
    return this.levels.at(i) as FormGroup;
  }

  itemsOf(i: number): FormArray<FormGroup> {
    return this.levelAt(i).get('items') as FormArray<FormGroup>;
  }

  itemAt(levelIdx: number, itemIdx: number): FormGroup {
    return this.itemsOf(levelIdx).at(itemIdx) as FormGroup;
  }

  // ─── Item operations ────────────────────────────────────────────────
  removeItem(levelIdx: number, itemIdx: number): void {
    const arr = this.itemsOf(levelIdx);
    if (itemIdx < 0 || itemIdx >= arr.length) return;
    arr.removeAt(itemIdx);
    this.productForm().markAsDirty();
    this.cdr.markForCheck();
  }

  dropItem(event: CdkDragDrop<FormGroup[]>, levelIdx: number): void {
    if (event.previousIndex === event.currentIndex) return;
    const arr = this.itemsOf(levelIdx);
    const snapshot = [...arr.controls];
    moveItemInArray(snapshot, event.previousIndex, event.currentIndex);
    while (arr.length > 0) arr.removeAt(0, { emitEvent: false });
    snapshot.forEach((g) => arr.push(g, { emitEvent: false }));
    arr.updateValueAndValidity();
    this.productForm().markAsDirty();
    this.cdr.markForCheck();
  }

  // ─── Picker ─────────────────────────────────────────────────────────
  /** Pick items for the currently active level. Pre-selects existing
   *  items so the user can uncheck to remove. */
  async openPickerForActive(): Promise<void> {
    const levelIdx = this.activeLevel();
    if (levelIdx < 0 || levelIdx >= this.levels.length) return;
    const arr = this.itemsOf(levelIdx);
    const existingIds = arr.controls.map((g) => g.value['productId']);

    const ref = this.modal.open<PickProductModalComponent, PickProductModalData, PickProductResult>(
      PickProductModalComponent,
      {
        data: {
          types: ['inventory', 'serialized', 'batch', 'service', 'menuItem', 'kit'],
          excludedIds: existingIds,
          multiple: true,
          title: 'Add selection items',
        },
        size: 'md',
      },
    );
    const result = await ref.afterClosed();
    if (!result) return;
    if (!result.added.length && !result.removed.length) return;

    if (result.removed.length) {
      const removeSet = new Set(result.removed);
      for (let i = arr.length - 1; i >= 0; i--) {
        if (removeSet.has(arr.at(i).value['productId'])) arr.removeAt(i);
      }
    }
    // Picker returns rows keyed as `id` (the linked product's UUID). The
    // backend wants that under `productId` on each item.
    result.added.forEach((p: PickedProduct) => arr.push(this.buildItemRow({
      productId:    p.id,
      name:         p.name,
      defaultPrice: p.price ?? 0,
      UOM:          p.UOM ?? '',
    })));
    this.productForm().markAsDirty();
    this.cdr.markForCheck();
  }
}
