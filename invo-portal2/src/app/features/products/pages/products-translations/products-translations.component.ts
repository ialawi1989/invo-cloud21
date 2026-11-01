import { Component, ViewChild, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';
import { TranslateModule } from '@ngx-translate/core';

import { LanguageService } from '@core/i18n/language.service';
import { ErrorService } from '@core/http/error.service';
import type { CanLeaveComponent } from '@core/guards/unsaved-changes.guard';
import { ListPageComponent } from '@shared/components/list-page/components/list-page.component';
import {
  ListCellTemplateDirective,
} from '@shared/components/list-page/directives/list-template.directives';
import {
  FilterConfig,
  ListQueryParams,
  MobileCardConfig,
  TableColumn,
} from '@shared/components/list-page/interfaces/list-page.types';
import {
  SegmentedToggleComponent,
  SegmentedToggleOption,
} from '@shared/components/segmented-toggle/segmented-toggle.component';
import { TranslateLinkComponent } from '@shared/components/translate-link/translate-link.component';
import {
  TranslationLang,
  TranslationModalComponent,
  TranslationModalData,
} from '@shared/components/translation-modal/translation-modal.component';
import { ToastService } from '@shared/components/toast/toast.service';
import { ModalService } from '@shared/modal/modal.service';
import {
  ConfirmModalComponent,
  ConfirmModalData,
} from '@shared/modal/demo/confirm-modal.component';

import { BulkTranslationService, TranslationEntity } from '../../services/bulk-translation.service';
import { ProductsService } from '../../services/products.service';
import {
  TRANSLATION_ENTITIES,
  TranslationEntityDef,
  TranslationFieldDef,
  findTranslationEntity,
} from './translation-entities';

/** Product types that live in the Products table. Matrix parents are edited on
 *  the Matrixes tab — their list id is the matrix id, so saving them here would
 *  update zero rows silently. */
const PRODUCT_TYPES = [
  'inventory', 'serialized', 'batch', 'kit', 'service',
  'package', 'menuItem', 'menuSelection', 'tailoring',
];

type TranslationMap = Record<string, Record<string, string>>;

/**
 * Products → Translation. One tabbed page over products, matrixes, departments,
 * categories, option groups, options and brands (port of InvoCloudFront2's
 * `products-translations`). Every translatable cell opens the shared
 * TranslationModalComponent, which edits ALL site languages for that field;
 * the whole `translation` object is sent back on save, so languages and keys
 * this page doesn't render are never dropped.
 *
 * Handoff from the products list: `?ids=a,b,c` scopes the Products tab to the
 * selection; `search` / `filter_<key>` are restored by the shared list page.
 */
@Component({
  selector: 'app-products-translations',
  standalone: true,
  imports: [
    CommonModule,
    TranslateModule,
    ListPageComponent,
    ListCellTemplateDirective,
    SegmentedToggleComponent,
    TranslateLinkComponent,
  ],
  templateUrl: './products-translations.component.html',
  styleUrl: './products-translations.component.scss',
})
export class ProductsTranslationsComponent implements CanLeaveComponent {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private lang = inject(LanguageService);
  private service = inject(BulkTranslationService);
  private productsService = inject(ProductsService);
  private modal = inject(ModalService);
  private toast = inject(ToastService);
  private errorService = inject(ErrorService);

  @ViewChild(ListPageComponent) listPage?: ListPageComponent;

  /** Active tab, driven by `?tab=` so it survives reloads and back/forward. */
  private tabParam = toSignal(
    this.route.queryParamMap.pipe(map((p) => p.get('tab'))),
    { initialValue: this.route.snapshot.queryParamMap.get('tab') },
  );
  def = computed<TranslationEntityDef>(() => findTranslationEntity(this.tabParam()));
  entity = computed<TranslationEntity>(() => this.def().entity);

  /** Selection handoff (`ids`), mirrored from the URL. */
  private idsParam = toSignal(
    this.route.queryParamMap.pipe(map((p) => p.get('ids'))),
    { initialValue: this.route.snapshot.queryParamMap.get('ids') },
  );
  scopedIds = computed<string[]>(() =>
    this.entity() === 'products'
      ? (this.idsParam() ?? '').split(',').map((s) => s.trim()).filter(Boolean)
      : [],
  );

  /** Edited translation objects keyed by row id (whole object, not a diff). */
  edits = signal<Map<string, TranslationMap>>(new Map());
  editedCount = computed(() => this.edits().size);
  saving = signal(false);

  tabs = computed<SegmentedToggleOption<TranslationEntity>[]>(() =>
    TRANSLATION_ENTITIES.map((d) => ({ value: d.entity, label: d.labelKey })),
  );

  columns = computed<TableColumn[]>(() => {
    const def = this.def();
    return [
      {
        key: def.sourceKey,
        label: this.lang.instant('PRODUCTS.TRANSLATION_PAGE.COL_SOURCE'),
        sortable: true,
        primary: true,
        locked: true,
        visible: true,
        // Fixed width + wrapping template (below) so long names wrap inside
        // their column instead of running under the translations.
        customTemplate: true,
        width: '280px',
        order: 0,
      } as TableColumn,
      ...def.fields.map((f, i) => ({
        key: `tr_${f.key}`,
        label: this.lang.instant(f.labelKey),
        sortable: false,
        customTemplate: true,
        noApi: true,
        visible: true,
        order: i + 1,
      } as TableColumn)),
    ];
  });

  filters = computed<FilterConfig[]>(() => {
    if (this.entity() !== 'products') return [];
    const t = (k: string) => this.lang.instant(k);
    return [
      {
        type: 'checkbox-group',
        key: 'types',
        label: t('PRODUCTS.FILTERS.TYPE'),
        options: [
          { value: 'inventory', label: t('PRODUCTS.TYPES.INVENTORY') },
          { value: 'serialized', label: t('PRODUCTS.TYPES.SERIALIZED') },
          { value: 'batch', label: t('PRODUCTS.TYPES.BATCH') },
          { value: 'kit', label: t('PRODUCTS.TYPES.KIT') },
          { value: 'service', label: t('PRODUCTS.TYPES.SERVICE') },
          { value: 'package', label: t('PRODUCTS.TYPES.PACKAGE') },
          { value: 'menuItem', label: t('PRODUCTS.TYPES.MENU_ITEM') },
          { value: 'menuSelection', label: t('PRODUCTS.TYPES.MENU_SELECTION') },
          { value: 'tailoring', label: t('PRODUCTS.TYPES.TAILORING') },
        ],
      },
      {
        type: 'dropdown',
        key: 'departmentId',
        label: t('PRODUCTS.FILTERS.DEPARTMENT'),
        loadFn: (params: any) => this.productsService.getDepartments(params),
      },
      {
        type: 'dropdown',
        key: 'categoryId',
        label: t('PRODUCTS.FILTERS.CATEGORY'),
        loadFn: (params: any) => this.productsService.getCategories(params),
      },
    ] as FilterConfig[];
  });

  paginationConfig = { enabled: true, pageLimits: [15, 25, 50, 100], default: 15 };
  sortingConfig = { enabled: true };
  searchConfig = computed(() => ({
    enabled: true,
    debounceMs: 500,
    placeholder: this.lang.instant('PRODUCTS.TRANSLATION_PAGE.SEARCH'),
  }));
  emptyState = computed(() => ({
    title: this.lang.instant('PRODUCTS.TRANSLATION_PAGE.EMPTY'),
    message: '',
  }));
  mobileCardConfig: MobileCardConfig = { showThumbnail: false, metricKeys: [], secondaryKey: '' };

  breadcrumbs = computed(() => [
    { label: 'Home', routerLink: '/', icon: 'home' as const, iconOnly: true },
    { label: this.lang.instant('PRODUCTS.TITLE'), routerLink: '/products' },
    { label: this.lang.instant('PRODUCTS.TRANSLATION_PAGE.TITLE'), routerLink: '/products/translation' },
  ]);

  hasUnsavedChanges(): boolean {
    return this.edits().size > 0;
  }

  // ── Data ────────────────────────────────────────────────────────────────
  loadRows = async (params: ListQueryParams) => {
    const entity = this.entity();
    let filter: Record<string, any> | undefined;
    if (entity === 'products') {
      const f = params.filter ?? {};
      const picked = this.toArray(f['types']).filter((t) => PRODUCT_TYPES.includes(t));
      filter = {
        type: picked.length ? picked : PRODUCT_TYPES,
        departments: f['departmentId'] ? [f['departmentId']] : [],
        categories: f['categoryId'] ? [f['categoryId']] : [],
      };
      const ids = this.scopedIds();
      if (ids.length) filter['ids'] = ids;
    }
    const data = await this.service.getList(entity, {
      page: params.page,
      limit: params.limit,
      searchTerm: params.searchTerm || '',
      sortBy: params.sortBy
        ? { sortValue: params.sortBy.sortValue, sortDirection: params.sortBy.sortDirection }
        : undefined,
      filter,
    });
    return { list: data.list, count: data.count, pageCount: data.pageCount };
  };

  private toArray(value: unknown): string[] {
    if (Array.isArray(value)) return value.map(String);
    if (value === null || value === undefined || value === '') return [];
    return String(value).split(',').filter(Boolean);
  }

  // ── Cell helpers ────────────────────────────────────────────────────────
  rowId(row: any): string {
    return String(row?.id ?? '');
  }

  sourceText(row: any): string {
    return String(row?.[this.def().sourceKey] ?? '');
  }

  isEdited(row: any): boolean {
    return this.edits().has(this.rowId(row));
  }

  private currentTranslation(row: any): TranslationMap {
    return this.edits().get(this.rowId(row)) ?? ((row?.translation as TranslationMap) ?? {});
  }

  /** Non-empty per-language values for a field, `en` first. */
  entries(row: any, field: TranslationFieldDef): { code: string; value: string }[] {
    const map = this.currentTranslation(row)[field.key] ?? {};
    return Object.entries(map)
      .filter(([, v]) => typeof v === 'string' && v.trim() !== '')
      .sort(([a], [b]) => (a === 'en' ? -1 : b === 'en' ? 1 : 0))
      .map(([code, value]) => ({ code, value }));
  }

  fieldByKey(key: string): TranslationFieldDef {
    return this.def().fields.find((f) => f.key === key) ?? this.def().fields[0];
  }

  // ── Editing (shared translation modal, every site language) ─────────────
  async edit(row: any, field: TranslationFieldDef): Promise<void> {
    const current = this.currentTranslation(row);
    const initial: Record<string, string> = { ...(current[field.key] ?? {}) };
    // Seed English with the source text when the name has no translation yet.
    if (field.key === 'name' && !initial['en']) initial['en'] = this.sourceText(row);

    const ref = this.modal.open<TranslationModalComponent, TranslationModalData, TranslationLang | null>(
      TranslationModalComponent,
      {
        size: 'sm',
        closeOnBackdrop: false,
        data: {
          initial,
          label: `${this.lang.instant(field.labelKey)} — ${this.sourceText(row)}`,
          multiline: !!field.multiline,
        },
      },
    );
    const result = await ref.afterClosed();
    if (!result) return;

    const next: Record<string, string> = { ...result };
    const keys = new Set([...Object.keys(initial), ...Object.keys(next)]);
    const unchanged = [...keys].every((k) => (initial[k] ?? '') === (next[k] ?? ''));
    if (unchanged) return;

    const merged: TranslationMap = { ...current, [field.key]: next };
    this.edits.update((m) => new Map(m).set(this.rowId(row), merged));
  }

  // ── Save ────────────────────────────────────────────────────────────────
  async save(): Promise<void> {
    if (this.saving() || this.edits().size === 0) return;
    const list = [...this.edits()].map(([id, translation]) => ({ id, translation }));
    this.saving.set(true);
    try {
      const res = await this.service.save(this.entity(), list);
      if (res.success) {
        this.toast.success(this.lang.instant('PRODUCTS.TRANSLATION_PAGE.SAVED'));
        this.edits.set(new Map());
        this.listPage?.refresh();
      } else {
        this.toast.error(res.msg || this.lang.instant('PRODUCTS.TRANSLATION_PAGE.SAVE_FAILED'));
      }
    } catch (error) {
      await this.errorService.handleError(error);
    } finally {
      this.saving.set(false);
    }
  }

  // ── Tabs / scope ────────────────────────────────────────────────────────
  async setTab(entity: TranslationEntity): Promise<void> {
    if (entity === this.entity()) return;
    if (this.edits().size > 0 && !(await this.confirmDiscard())) return;
    this.edits.set(new Map());

    // Reset the shared list-page state (page/search/sort/filters/columns) so
    // the new tab starts clean; `merge` keeps nothing else we care about.
    const params: Record<string, any> = {
      tab: entity === 'products' ? null : entity,
      ids: null, page: null, limit: null, search: null,
      sortBy: null, sortDir: null, columns: null,
    };
    for (const key of Object.keys(this.route.snapshot.queryParams)) {
      if (key.startsWith('filter_')) params[key] = null;
    }
    await this.router.navigate([], {
      relativeTo: this.route,
      queryParams: params,
      queryParamsHandling: 'merge',
    });
  }

  async showAll(): Promise<void> {
    await this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { ids: null },
      queryParamsHandling: 'merge',
    });
    this.listPage?.refresh();
  }

  private async confirmDiscard(): Promise<boolean> {
    const ref = this.modal.open<ConfirmModalComponent, ConfirmModalData, boolean>(
      ConfirmModalComponent,
      {
        size: 'sm',
        data: {
          title: this.lang.instant('COMMON.UNSAVED_TITLE'),
          message: this.lang.instant('COMMON.UNSAVED_HINT'),
          confirm: this.lang.instant('COMMON.LEAVE'),
          danger: true,
        },
      },
    );
    return !!(await ref.afterClosed());
  }
}
