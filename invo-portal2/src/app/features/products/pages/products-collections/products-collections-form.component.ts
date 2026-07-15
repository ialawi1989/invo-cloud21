import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  HostListener,
  OnInit,
  computed,
  effect,
  inject,
  signal,
  untracked,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { DragDropModule, CdkDragDrop, moveItemInArray } from '@angular/cdk/drag-drop';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { withTranslations } from '@core/i18n/with-translations';
import type { CanLeaveComponent } from '@core/guards/unsaved-changes.guard';
import { BreadcrumbsComponent } from '@shared/components/breadcrumbs/breadcrumbs.component';
import type { BreadcrumbItem } from '@shared/components/breadcrumbs/breadcrumbs.types';
import { LoadingOverlayComponent } from '@shared/components/spinner/loading-overlay.component';
import { ToastService } from '@shared/components/toast/toast.service';
import { ModalService } from '@shared/modal/modal.service';
import {
  SegmentedToggleComponent,
  SegmentedToggleOption,
} from '@shared/components/segmented-toggle/segmented-toggle.component';
import { SearchDropdownComponent } from '@shared/components/dropdown/search-dropdown.component';
import { DropdownLoadFn } from '@shared/components/dropdown/search-dropdown.types';
import {
  TranslationModalComponent,
  TranslationModalData,
  TranslationLang,
} from '@shared/components/translation-modal/translation-modal.component';
import {
  MediaPickerModalComponent,
  MediaPickerConfig,
} from '@features/settings/media/components/media-picker/media-picker-modal.component';
import { Media } from '@features/settings/media/models/media.model';
import {
  PickProductModalComponent,
  PickProductModalData,
  PickProductResult,
} from '../product-form/components/pick-product-modal/pick-product-modal.component';

import { ProductsService } from '../../services/products.service';
import {
  Collection,
  CollectionType,
  CollectionMatch,
  AutoCollectionData,
  ManualCollectionData,
  emptyCollection,
  emptyManualData,
  emptyAutoData,
  emptyCondition,
  normalizeCollection,
  slugify,
} from '../../services/collection.types';

/** Option shape used by the async product/category/etc. dropdowns. */
interface Opt {
  label: string;
  value: string;
}

/** Comparison metadata — mirrors the legacy `comparisons` config. */
interface Comparison {
  title: string;
  value: string;
  comparison: { value: string; title: string }[];
}

const NAME_COMPARATORS = [
  { value: 'isEqual', title: 'is equal to' },
  { value: 'isNotEqual', title: 'is not equal to' },
  { value: 'startsWith', title: 'starts with' },
  { value: 'endsWith', title: 'ends with' },
  { value: 'contains', title: 'contains' },
  { value: 'notContain', title: 'does not contain' },
];
const NUMERIC_COMPARATORS = [
  { value: 'isEqual', title: 'is equal to' },
  { value: 'startsWith', title: 'greater than' },
  { value: 'endsWith', title: 'less than' },
];

/**
 * Product-collection editor (`/products-collections/:id`,
 * `:id === 'new'` → create). Modern port of the legacy
 * `products-collections-form.component`.
 *
 * Same chrome as the other product forms: signal model, snapshot-based dirty
 * tracking + unsaved-changes guard, Cmd/Ctrl+S save, toast + navigate to the
 * list on success. Cover image via the shared media picker; title/description
 * translations via the shared translation modal; product / condition-value
 * pickers via `<app-search-dropdown>` (no native `<select>`).
 */
@Component({
  selector: 'app-products-collections-form',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    DragDropModule,
    TranslateModule,
    BreadcrumbsComponent,
    LoadingOverlayComponent,
    SegmentedToggleComponent,
    SearchDropdownComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './products-collections-form.component.html',
  styleUrl: './products-collections-form.component.scss',
})
export class ProductsCollectionsFormComponent implements OnInit, CanLeaveComponent {
  private products = inject(ProductsService);
  private translate = inject(TranslateService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private toast = inject(ToastService);
  private modal = inject(ModalService);
  private destroyRef = inject(DestroyRef);

  loading = signal<boolean>(false);
  saving = signal<boolean>(false);

  collection = signal<Collection>(emptyCollection());

  private isCreate = signal<boolean>(true);
  cleanSnapshot = signal<string>('');

  nameValidating = signal<boolean>(false);
  nameDuplicate = signal<boolean>(false);
  private nameCheckDebounce?: ReturnType<typeof setTimeout>;
  private nameCheckToken = 0;

  private i18nTick = signal(0);

  // ── Static option config (ported) ──────────────────────────────────
  readonly typeOptions: SegmentedToggleOption<CollectionType>[] = [
    { value: 'Manual', label: 'PRODUCTS.COLLECTIONS.FORM.TYPE_MANUAL' },
    { value: 'Auto', label: 'PRODUCTS.COLLECTIONS.FORM.TYPE_AUTO' },
  ];

  readonly matchOptions: SegmentedToggleOption<CollectionMatch>[] = [
    { value: 'all', label: 'PRODUCTS.COLLECTIONS.FORM.MATCH_ALL' },
    { value: 'any', label: 'PRODUCTS.COLLECTIONS.FORM.MATCH_ANY' },
  ];

  readonly productTypes: Opt[] = [
    { value: 'inventory', label: 'Inventory' },
    { value: 'serialized', label: 'Serialized' },
    { value: 'batch', label: 'Batch' },
    { value: 'kit', label: 'Kit' },
    { value: 'service', label: 'Service' },
    { value: 'package', label: 'Package' },
    { value: 'menuItem', label: 'Menu Item' },
    { value: 'menuSelection', label: 'Menu Selection' },
    { value: 'tailoring', label: 'Tailoring' },
  ];

  readonly sortOptions: Opt[] = [
    { value: 'bestSelling', label: 'Best Selling' },
    { value: 'productTitleAsc', label: 'Product title A-Z' },
    { value: 'productTitleDesc', label: 'Product title Z-A' },
    { value: 'highestPrice', label: 'Highest price' },
    { value: 'lowPrice', label: 'Lowest price' },
    { value: 'newest', label: 'Newest' },
    { value: 'oldest', label: 'Oldest' },
  ];

  readonly comparisons: Comparison[] = [
    { title: 'Name', value: 'Name', comparison: NAME_COMPARATORS },
    { title: 'Type', value: 'Type', comparison: NAME_COMPARATORS },
    { title: 'Category', value: 'Category', comparison: NAME_COMPARATORS },
    { title: 'Department', value: 'Department', comparison: NAME_COMPARATORS },
    { title: 'Tag', value: 'Tag', comparison: NAME_COMPARATORS },
    { title: 'Price', value: 'Price', comparison: NUMERIC_COMPARATORS },
    { title: 'On hand', value: 'On hand', comparison: NUMERIC_COMPARATORS },
  ];

  readonly comparisonOpts: Opt[] = this.comparisons.map((c) => ({ label: c.title, value: c.value }));

  // ── Computed view state ────────────────────────────────────────────
  pageTitle = computed<string>(() => {
    this.i18nTick();
    return !this.isCreate()
      ? this.translate.instant('PRODUCTS.COLLECTIONS.FORM.EDIT_TITLE')
      : this.translate.instant('PRODUCTS.COLLECTIONS.FORM.NEW_TITLE');
  });

  breadcrumbs = computed<BreadcrumbItem[]>(() => {
    this.i18nTick();
    return [
      { label: this.translate.instant('PRODUCTS.COLLECTIONS.TITLE'), routerLink: '/products-collections' },
      { label: this.pageTitle() },
    ];
  });

  isManual = computed<boolean>(() => this.collection().type === 'Manual');
  manualData = computed<ManualCollectionData>(() => this.collection().data as ManualCollectionData);
  autoData = computed<AutoCollectionData>(() => this.collection().data as AutoCollectionData);

  nameError = computed<string | null>(() => {
    if (!this.collection().title.trim()) return 'PRODUCTS.COLLECTIONS.FORM.TITLE_REQUIRED';
    if (this.nameDuplicate()) return 'PRODUCTS.COLLECTIONS.FORM.TITLE_DUPLICATE';
    return null;
  });

  /** Mirror of the legacy `isCollectionLinesValid`. */
  linesValid = computed<boolean>(() => {
    const c = this.collection();
    if (c.type === 'Manual') return (c.data as ManualCollectionData).ids.length > 0;
    const auto = c.data as AutoCollectionData;
    return auto.conditions.length > 0 && auto.conditions.every((cond) => this.isConditionValueValid(cond));
  });

  isDirty = computed<boolean>(() => this.snapshot() !== this.cleanSnapshot());

  canSave = computed<boolean>(
    () => !this.nameError() && this.linesValid() && !this.saving() && this.isDirty(),
  );

  constructor() {
    withTranslations('products');
    this.translate.onLangChange
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.i18nTick.update((n) => n + 1));
    this.translate.onTranslationChange
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.i18nTick.update((n) => n + 1));

    // Debounced async title-uniqueness — mirrors dimension-form. Skips when the
    // value matches the saved snapshot so a freshly-loaded record doesn't ping
    // the backend about a title it already owns.
    effect(() => {
      const c = this.collection();
      const title = c.title.trim();
      const isPristine = untracked(() => this.snapshot() === this.cleanSnapshot());

      clearTimeout(this.nameCheckDebounce);
      if (!title || isPristine) {
        this.nameValidating.set(false);
        this.nameDuplicate.set(false);
        return;
      }

      this.nameValidating.set(true);
      const myToken = ++this.nameCheckToken;
      this.nameCheckDebounce = setTimeout(async () => {
        try {
          const res = await this.products.validateName({
            tableName: 'collection',
            id: c.id || '',
            name: title,
          });
          if (myToken !== this.nameCheckToken) return;
          this.nameDuplicate.set(!res.success);
        } catch {
          if (myToken === this.nameCheckToken) this.nameDuplicate.set(false);
        } finally {
          if (myToken === this.nameCheckToken) this.nameValidating.set(false);
        }
      }, 500);
    });
  }

  async ngOnInit(): Promise<void> {
    const id = this.route.snapshot.paramMap.get('id');
    if (id && id !== 'new' && id !== '0') {
      this.isCreate.set(false);
      this.loading.set(true);
      try {
        const raw = await this.products.getCollectionById(id);
        const fresh = normalizeCollection(raw);
        this.collection.set(fresh);
        this.cleanSnapshot.set(this.snapshot());
      } finally {
        this.loading.set(false);
      }
    } else {
      this.cleanSnapshot.set(this.snapshot());
    }
  }

  // ── Field setters ──────────────────────────────────────────────────
  setTitle(v: string): void {
    this.collection.update((c) => ({ ...c, title: v, slug: slugify(v) }));
  }

  setDescription(v: string): void {
    this.collection.update((c) => ({ ...c, description: v }));
  }

  setType(t: CollectionType): void {
    // Swap the `data` payload wholesale so Manual/Auto never carry stale fields.
    this.collection.update((c) => ({
      ...c,
      type: t,
      data: t === 'Manual' ? emptyManualData() : emptyAutoData(),
    }));
  }

  setMatch(m: CollectionMatch): void {
    this.collection.update((c) => ({ ...c, data: { ...(c.data as AutoCollectionData), match: m } }));
  }

  setSortBy(v: any): void {
    this.collection.update((c) => ({ ...c, data: { ...(c.data as AutoCollectionData), sortBy: v ?? '' } }));
  }

  // ── Cover image ────────────────────────────────────────────────────
  async chooseImage(): Promise<void> {
    const ref = this.modal.open<MediaPickerModalComponent, MediaPickerConfig, Media | Media[] | undefined>(
      MediaPickerModalComponent,
      {
        size: 'xl',
        data: {
          contentTypes: ['image'],
          title: this.translate.instant('PRODUCTS.COLLECTIONS.FORM.CHOOSE_IMAGE'),
          preSelectedIds: this.collection().mediaId ? [this.collection().mediaId!] : [],
        },
      },
    );
    const result = await ref.afterClosed();
    const media = Array.isArray(result) ? result[0] : result;
    if (media) {
      this.collection.update((c) => ({
        ...c,
        mediaId: media.id,
        mediaUrl: { defaultUrl: media.imageUrl, thumbnailUrl: media.thumbUrl },
      }));
    }
  }

  removeImage(): void {
    this.collection.update((c) => ({ ...c, mediaId: null, mediaUrl: { defaultUrl: '', thumbnailUrl: '' } }));
  }

  // ── Translate ──────────────────────────────────────────────────────
  async translateTitle(): Promise<void> {
    const c = this.collection();
    const result = await this.openTranslation(
      { ...c.translation.title, en: c.translation.title.en || c.title },
      'PRODUCTS.COLLECTIONS.FORM.TITLE',
    );
    if (result) {
      this.collection.update((col) => ({
        ...col,
        title: result.en,
        slug: slugify(result.en),
        translation: { ...col.translation, title: { ...result } },
      }));
    }
  }

  async translateDescription(): Promise<void> {
    const c = this.collection();
    const result = await this.openTranslation(
      { ...c.translation.description, en: c.translation.description.en || c.description },
      'PRODUCTS.COLLECTIONS.FORM.DESCRIPTION',
    );
    if (result) {
      this.collection.update((col) => ({
        ...col,
        description: result.en,
        translation: { ...col.translation, description: { ...result } },
      }));
    }
  }

  private async openTranslation(initial: TranslationLang, label: string): Promise<TranslationLang | null> {
    const ref = this.modal.open<TranslationModalComponent, TranslationModalData, TranslationLang | null>(
      TranslationModalComponent,
      { size: 'md', data: { initial, label: this.translate.instant(label) } },
    );
    return (await ref.afterClosed()) ?? null;
  }

  // ── Manual: product picker (shared modal) ──────────────────────────
  /** Open the shared paginated product picker modal (thumbnail + type +
   *  price + barcode rows, multi-select, search). Already-pinned products are
   *  pre-checked via `excludedIds`; on confirm we apply the added/removed
   *  deltas to the manual list. */
  async openProductPicker(): Promise<void> {
    const data = this.collection().data as ManualCollectionData;
    const ref = this.modal.open<PickProductModalComponent, PickProductModalData, PickProductResult>(
      PickProductModalComponent,
      {
        size: 'md',
        data: {
          excludedIds: data.ids,
          multiple: true,
          title: this.translate.instant('PRODUCTS.COLLECTIONS.FORM.PICK_PRODUCTS'),
        },
      },
    );
    const res = await ref.afterClosed();
    if (!res) return;
    this.collection.update((c) => {
      const d = c.data as ManualCollectionData;
      let ids = [...d.ids];
      let products = [...d.products];
      if (res.removed?.length) {
        const rm = new Set(res.removed);
        ids = ids.filter((id) => !rm.has(id));
        products = products.filter((p) => !rm.has(p.id));
      }
      for (const p of res.added) {
        if (!ids.includes(p.id)) {
          ids.push(p.id);
          products.push({ id: p.id, name: p.name });
        }
      }
      return { ...c, data: { ...d, ids, products } };
    });
  }

  removeProduct(index: number): void {
    this.collection.update((c) => {
      const data = c.data as ManualCollectionData;
      return {
        ...c,
        data: {
          ...data,
          ids: data.ids.filter((_, i) => i !== index),
          products: data.products.filter((_, i) => i !== index),
        },
      };
    });
  }

  dropProduct(event: CdkDragDrop<unknown>): void {
    this.collection.update((c) => {
      const data = c.data as ManualCollectionData;
      const ids = [...data.ids];
      const products = [...data.products];
      moveItemInArray(ids, event.previousIndex, event.currentIndex);
      moveItemInArray(products, event.previousIndex, event.currentIndex);
      return { ...c, data: { ...data, ids, products } };
    });
  }

  // ── Auto: conditions ───────────────────────────────────────────────
  addCondition(): void {
    this.collection.update((c) => {
      const data = c.data as AutoCollectionData;
      return { ...c, data: { ...data, conditions: [...data.conditions, emptyCondition()] } };
    });
  }

  removeCondition(index: number): void {
    this.collection.update((c) => {
      const data = c.data as AutoCollectionData;
      return { ...c, data: { ...data, conditions: data.conditions.filter((_, i) => i !== index) } };
    });
  }

  setConditionType(index: number, type: any): void {
    this.collection.update((c) => {
      const data = c.data as AutoCollectionData;
      const conditions = data.conditions.map((cond, i) =>
        i === index ? { ...cond, type: type ?? 'Price', value: '' } : cond,
      );
      return { ...c, data: { ...data, conditions } };
    });
  }

  setConditionComparator(index: number, comparator: any): void {
    this.collection.update((c) => {
      const data = c.data as AutoCollectionData;
      const conditions = data.conditions.map((cond, i) =>
        i === index ? { ...cond, condition: comparator ?? 'isEqual' } : cond,
      );
      return { ...c, data: { ...data, conditions } };
    });
  }

  setConditionValue(index: number, value: any): void {
    this.collection.update((c) => {
      const data = c.data as AutoCollectionData;
      const conditions = data.conditions.map((cond, i) => (i === index ? { ...cond, value } : cond));
      return { ...c, data: { ...data, conditions } };
    });
  }

  /** Comparator options for a condition's field type. */
  comparatorOpts(type: string): Opt[] {
    const found = this.comparisons.find((c) => c.value === type);
    return (found?.comparison ?? []).map((c) => ({ label: c.title, value: c.value }));
  }

  /** Which editor a condition value uses: a plain input, or a picker. */
  valueEditor(cond: { type: string; condition: string }): 'input' | 'picker' {
    if (cond.type === 'Price' || cond.type === 'On hand') return 'input';
    return cond.condition === 'isEqual' || cond.condition === 'isNotEqual' ? 'picker' : 'input';
  }

  /** For picker-type condition values, the async loader keyed on field type.
   *  Returns `null` for the static Type list (rendered from `productTypes`). */
  pickerLoad(type: string): DropdownLoadFn<Opt> | null {
    if (type === 'Name') {
      return async ({ page, pageSize, search }) => {
        const res = await this.products.getProductList({ page, limit: pageSize, searchTerm: search, sortBy: {}, filter: {} });
        return {
          items: res.list.map((p: any) => ({ label: p.name, value: p.name })),
          hasMore: page * pageSize < res.count,
        };
      };
    }
    if (type === 'Category') {
      return async ({ page, pageSize, search }) => {
        const res = await this.products.getCategories({ page, pageSize, search });
        return { items: res.items.map((i) => ({ label: i.label, value: i.label })), hasMore: res.hasMore };
      };
    }
    if (type === 'Department') {
      return async ({ page, pageSize, search }) => {
        const res = await this.products.getDepartments({ page, pageSize, search });
        return { items: res.items.map((i) => ({ label: i.label, value: i.label })), hasMore: res.hasMore };
      };
    }
    if (type === 'Tag') {
      return async ({ page, pageSize, search }) => {
        const res = await this.products.getProductTags({ page, pageSize, search });
        return { items: res.items.map((i) => ({ label: i.label, value: String(i.value) })), hasMore: res.hasMore };
      };
    }
    return null;
  }

  isConditionValueValid(cond: { type: string; value: any }): boolean {
    if (cond.type === 'Price' || cond.type === 'On hand') {
      return !isNaN(parseFloat(cond.value)) && isFinite(cond.value);
    }
    return isNaN(parseFloat(cond.value)) && !!(cond.value?.length);
  }

  /** Tolerant label resolver — receives a full `Opt` when the picker has the
   *  item loaded, or the raw persisted string (e.g. a category name in edit
   *  mode before its page is fetched), in which case we show the string. */
  displayOpt = (o: Opt | string): string => (typeof o === 'string' ? o : o?.label ?? '');
  optValue = (o: Opt): string => o?.value;
  compareOpt = (a: any, b: any): boolean => (a?.value ?? a) === (b?.value ?? b);

  // ── Save / cancel ──────────────────────────────────────────────────
  async save(): Promise<void> {
    if (!this.canSave()) return;
    this.saving.set(true);
    try {
      const payload: Collection = { ...this.collection() };
      if (this.isCreate()) payload.id = null;
      // Keep the EN mirror of the translation in sync with the plain fields,
      // preserving every other language already captured in the modal.
      payload.translation = {
        title: { ...payload.translation.title, en: payload.title },
        description: { ...payload.translation.description, en: payload.description },
      };

      const res = await this.products.saveCollection(payload);
      if (res?.success) {
        this.toast.success('PRODUCTS.COLLECTIONS.FORM.SAVED_OK');
        this.cleanSnapshot.set(this.snapshot());
        void this.router.navigate(['/products-collections']);
      } else {
        this.toast.error('PRODUCTS.COLLECTIONS.FORM.SAVE_FAILED', res?.msg);
      }
    } catch (err: any) {
      this.toast.error('PRODUCTS.COLLECTIONS.FORM.SAVE_FAILED', err?.message);
    } finally {
      this.saving.set(false);
    }
  }

  cancel(): void {
    void this.router.navigate(['/products-collections']);
  }

  // ── Unsaved-changes guard ──────────────────────────────────────────
  private snapshot(): string {
    return JSON.stringify(this.collection());
  }
  hasUnsavedChanges(): boolean {
    return this.snapshot() !== this.cleanSnapshot();
  }

  @HostListener('document:keydown', ['$event'])
  onKeydown(ev: KeyboardEvent): void {
    if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === 's') {
      ev.preventDefault();
      void this.save();
    }
  }
}
