import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  linkedSignal,
  output,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

import { MycurrencyPipe } from '@core/pipes/mycurrency.pipe';
import { ToastService } from '@shared/components/toast/toast.service';
import { ModalService } from '@shared/modal/modal.service';
import {
  ConfirmModalComponent,
  ConfirmModalData,
} from '@shared/modal/demo/confirm-modal.component';

import {
  MenuRecipeItem,
  ProductRecipeService,
  RecipeOwnerType,
} from '../../services/product-recipe.service';
import {
  PickProductModalComponent,
  PickProductModalData,
  PickProductResult,
  PickedProduct,
} from '../../pages/product-form/components/pick-product-modal/pick-product-modal.component';

/**
 * Prep-recipe editor for one owner (a menu-item product or an option): the
 * recipe lines with editable usage, per-line revert / save / delete, and an
 * "add item" picker. Persists line-by-line through the shared
 * saveRecipeItem / deleteRecipeItem endpoints.
 *
 * Owns its own line state so hosts only hand it a starting list. Feed `items`
 * when the host already has them (Product Recipe ships them with the list);
 * set `autoLoad` when it should fetch them itself (options, which are loaded
 * lazily on row expansion).
 */
@Component({
  selector: 'app-prep-recipe-panel',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslateModule, MycurrencyPipe],
  templateUrl: './prep-recipe-panel.component.html',
  styleUrl: './prep-recipe-panel.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PrepRecipePanelComponent {
  private service = inject(ProductRecipeService);
  private translate = inject(TranslateService);
  private modal = inject(ModalService);
  private toast = inject(ToastService);

  /** Which endpoint family the lines are saved through. */
  readonly ownerType = input.required<RecipeOwnerType>();
  /** Id of the product / option the lines hang off. */
  readonly ownerId = input.required<string>();
  /** Starting lines. Ignored when `autoLoad` is set. */
  readonly items = input<MenuRecipeItem[]>([]);
  /** Fetch the lines from the server instead of taking them from `items`. */
  readonly autoLoad = input<boolean>(false);
  /** Hide the "N items" heading when the host already shows a count. */
  readonly showHeader = input<boolean>(true);

  /** Fires on every mutation so hosts can keep their own copy in sync. */
  readonly linesChange = output<MenuRecipeItem[]>();
  /** Fires while a save/delete is in flight, for a host-level overlay. */
  readonly busyChange = output<boolean>();

  /** Editable lines — reseeded whenever the `items` input changes identity. */
  readonly lines = linkedSignal<MenuRecipeItem[], MenuRecipeItem[]>({
    source: this.items,
    computation: (incoming) => incoming.map((i) => ({ ...i })),
  });

  readonly loading = signal(false);
  readonly saving = signal(false);

  readonly totalCost = computed(() =>
    this.lines().reduce((sum, i) => sum + this.lineCost(i), 0),
  );

  constructor() {
    // Lazy owners (options) fetch their lines the first time the panel renders
    // for a given id.
    effect(() => {
      const id = this.ownerId();
      if (!this.autoLoad() || !id) return;
      void this.load(id);
    });

    effect(() => this.busyChange.emit(this.saving()));
  }

  private async load(ownerId: string): Promise<void> {
    this.loading.set(true);
    try {
      this.lines.set(await this.service.getItems(this.ownerType(), ownerId));
    } finally {
      this.loading.set(false);
    }
  }

  // ── Line helpers ──────────────────────────────────────────────────────────
  private itemKey(item: MenuRecipeItem): string {
    return item.inventoryId ?? item.recipeId ?? '';
  }

  isModified(item: MenuRecipeItem): boolean {
    return !!item.isNew || Number(item.usages) !== Number(item.originalUsages ?? 0);
  }

  lineCost(item: MenuRecipeItem): number {
    return (Number(item.usages) || 0) * (Number(item.unitCost) || 0);
  }

  private patch(key: string, change: Partial<MenuRecipeItem>): void {
    this.lines.update((list) =>
      list.map((r) => (this.itemKey(r) === key ? { ...r, ...change } : r)),
    );
    this.linesChange.emit(this.lines());
  }

  setUsage(item: MenuRecipeItem, value: string | number): void {
    const usages = Number(value);
    this.patch(this.itemKey(item), { usages: isNaN(usages) ? 0 : usages });
  }

  revert(item: MenuRecipeItem): void {
    this.patch(this.itemKey(item), { usages: item.originalUsages ?? 0 });
  }

  // ── Persistence ───────────────────────────────────────────────────────────
  async saveLine(item: MenuRecipeItem): Promise<void> {
    if (Number(item.usages) <= 0) return;
    this.saving.set(true);
    try {
      const res = await this.service.saveRecipeItem(this.ownerType(), this.ownerId(), item);
      if (res.success) {
        this.patch(this.itemKey(item), { originalUsages: item.usages, isNew: false });
        this.toast.success('COMMON.SAVED_OK');
      } else {
        this.toast.error('COMMON.SAVE_FAILED');
      }
    } catch (e: any) {
      this.toast.error('COMMON.SAVE_FAILED', e?.message);
    } finally {
      this.saving.set(false);
    }
  }

  async removeLine(item: MenuRecipeItem): Promise<void> {
    const key = this.itemKey(item);
    // Never-saved rows just drop out locally.
    if (item.isNew) {
      this.dropLine(key);
      return;
    }
    const ref = this.modal.open<ConfirmModalComponent, ConfirmModalData, boolean>(
      ConfirmModalComponent,
      {
        size: 'sm',
        data: {
          title: this.translate.instant('COMMON.DELETE'),
          message: this.translate.instant('PRODUCTS.PRODUCT_RECIPE.CONFIRM_DELETE', { name: item.name }),
          confirm: this.translate.instant('COMMON.DELETE'),
          danger: true,
        },
      },
    );
    if (!(await ref.afterClosed())) return;
    this.saving.set(true);
    try {
      const res = await this.service.deleteRecipeItem(this.ownerType(), this.ownerId(), key);
      if (res.success) {
        this.dropLine(key);
        this.toast.success('COMMON.DELETED_OK');
      } else {
        this.toast.error('COMMON.DELETE_FAILED');
      }
    } finally {
      this.saving.set(false);
    }
  }

  private dropLine(key: string): void {
    this.lines.update((list) => list.filter((r) => this.itemKey(r) !== key));
    this.linesChange.emit(this.lines());
  }

  // ── Add items ─────────────────────────────────────────────────────────────
  async addItems(): Promise<void> {
    const existing = this.lines().map((r) => this.itemKey(r)).filter(Boolean);
    const ref = this.modal.open<PickProductModalComponent, PickProductModalData, PickProductResult>(
      PickProductModalComponent,
      {
        size: 'lg',
        data: {
          excludedIds: existing,
          multiple: true,
          title: this.translate.instant('PRODUCTS.PRODUCT_RECIPE.ADD_ITEM'),
        },
        closeOnBackdrop: false,
      },
    );
    const result = await ref.afterClosed();
    if (!result?.added?.length) return;

    const seen = new Set(existing.map(String));
    const fresh = result.added
      .filter((pr) => !seen.has(String(pr.id)))
      .map((pr) => this.toRecipeItem(pr));
    if (!fresh.length) return;

    this.lines.update((list) => [...list, ...fresh]);
    this.linesChange.emit(this.lines());
  }

  private toRecipeItem(pr: PickedProduct): MenuRecipeItem {
    const isRecipe = pr.type === 'Recipe';
    return {
      inventoryId: isRecipe ? undefined : String(pr.id),
      recipeId: isRecipe ? String(pr.id) : undefined,
      name: pr.name ?? '',
      UOM: pr.UOM ?? '',
      unitCost: Number(pr.unitCost) || 0,
      usages: 1,
      type: pr.type ?? '',
      originalUsages: 0,
      isNew: true,
    };
  }

  trackItem = (_: number, r: MenuRecipeItem) => r.inventoryId ?? r.recipeId ?? r.name;
}
