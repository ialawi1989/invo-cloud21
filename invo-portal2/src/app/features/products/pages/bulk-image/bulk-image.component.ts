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
import { ListCellTemplateDirective } from '@shared/components/list-page/directives/list-template.directives';
import {
  FilterConfig,
  ListQueryParams,
  MobileCardConfig,
  TableColumn,
} from '@shared/components/list-page/interfaces/list-page.types';
import { ToastService } from '@shared/components/toast/toast.service';
import { ModalService } from '@shared/modal/modal.service';
import {
  MediaPickerConfig,
  MediaPickerModalComponent,
} from '@features/settings/media/components/media-picker/media-picker-modal.component';
import { Media } from '@features/settings/media/models/media.model';

import { ProductsService } from '../../services/products.service';

/** Same cap as the product form's gallery (and the legacy page). */
const MAX_IMAGES = 5;

export interface AssignedImage {
  id: string;
  defaultUrl: string;
  thumbnailUrl: string;
}

/**
 * Products → Bulk Image. Assign up to 5 images to many products in one pass
 * (port of InvoCloudFront2's `bulk-image`). The first image becomes the
 * product's main image — the backend writes `mediaId = mediaIds[0]`.
 *
 * Edits are kept per product id across pages and filters until saved. Handoff
 * from the products list: `?ids=a,b,c` scopes the page to the selection;
 * `search` / `filter_<key>` are restored by the shared list page.
 */
@Component({
  selector: 'app-bulk-image',
  standalone: true,
  imports: [CommonModule, TranslateModule, ListPageComponent, ListCellTemplateDirective],
  templateUrl: './bulk-image.component.html',
  styleUrl: './bulk-image.component.scss',
})
export class BulkImageComponent implements CanLeaveComponent {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private lang = inject(LanguageService);
  private products = inject(ProductsService);
  private modal = inject(ModalService);
  private toast = inject(ToastService);
  private errorService = inject(ErrorService);

  @ViewChild(ListPageComponent) listPage?: ListPageComponent;

  readonly maxImages = MAX_IMAGES;

  /** Selection handoff (`ids`), mirrored from the URL. */
  private idsParam = toSignal(
    this.route.queryParamMap.pipe(map((p) => p.get('ids'))),
    { initialValue: this.route.snapshot.queryParamMap.get('ids') },
  );
  scopedIds = computed<string[]>(() =>
    (this.idsParam() ?? '').split(',').map((s) => s.trim()).filter(Boolean),
  );

  /** Pending image lists keyed by product id (full replacement list). */
  edits = signal<Map<string, AssignedImage[]>>(new Map());
  editedCount = computed(() => this.edits().size);
  saving = signal(false);

  columns: TableColumn[] = [];
  filters: FilterConfig[] = [];
  breadcrumbs: { label: string; routerLink: string; icon?: 'home'; iconOnly?: boolean }[] = [];
  paginationConfig = { enabled: true, pageLimits: [15, 25, 50, 100], default: 15 };
  sortingConfig = { enabled: false };
  searchConfig = { enabled: true, debounceMs: 500, placeholder: '' };
  emptyState = { title: '', message: '' };
  mobileCardConfig: MobileCardConfig = { showThumbnail: false, metricKeys: [], secondaryKey: '' };

  constructor() {
    const t = (k: string) => this.lang.instant(k);
    this.columns = [
      { key: 'name', label: t('PRODUCTS.BULK_IMAGE_PAGE.COL_PRODUCT'), primary: true, locked: true, visible: true, order: 0 } as TableColumn,
      { key: 'images', label: t('PRODUCTS.BULK_IMAGE_PAGE.COL_IMAGES'), customTemplate: true, noApi: true, visible: true, order: 1 } as TableColumn,
    ];
    this.filters = [
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
          { value: 'matrix', label: t('PRODUCTS.TYPES.MATRIX') },
        ],
      },
      {
        type: 'dropdown',
        key: 'departmentId',
        label: t('PRODUCTS.FILTERS.DEPARTMENT'),
        loadFn: (params: any) => this.products.getDepartments(params),
      },
      {
        type: 'dropdown',
        key: 'categoryId',
        label: t('PRODUCTS.FILTERS.CATEGORY'),
        loadFn: (params: any) => this.products.getCategories(params),
      },
      {
        type: 'dropdown',
        key: 'tags',
        label: t('PRODUCTS.FILTERS.TAGS'),
        multiple: true,
        position: 'top',
        loadFn: (params: any) => this.products.getProductTags(params),
      },
    ] as FilterConfig[];
    this.breadcrumbs = [
      { label: 'Home', routerLink: '/', icon: 'home', iconOnly: true },
      { label: t('PRODUCTS.TITLE'), routerLink: '/products' },
      { label: t('PRODUCTS.BULK_IMAGE_PAGE.TITLE'), routerLink: '/products/bulk-image' },
    ];
    this.searchConfig.placeholder = t('PRODUCTS.BULK_IMAGE_PAGE.SEARCH');
    this.emptyState = { title: t('PRODUCTS.BULK_IMAGE_PAGE.EMPTY'), message: '' };
  }

  hasUnsavedChanges(): boolean {
    return this.edits().size > 0;
  }

  // ── Data ────────────────────────────────────────────────────────────────
  loadRows = async (params: ListQueryParams) => {
    const f = params.filter ?? {};
    const body: Record<string, any> = {
      page: params.page,
      limit: params.limit,
      searchTerm: params.searchTerm || '',
      filter: {
        types: this.toArray(f['types']),
        departments: f['departmentId'] ? [f['departmentId']] : [],
        categories: f['categoryId'] ? [f['categoryId']] : [],
        tags: this.toArray(f['tags']),
      },
    };
    const ids = this.scopedIds();
    if (ids.length) body['ids'] = ids;

    const raw: any = await this.products.getProductForMedia(body);
    const list: any[] = Array.isArray(raw?.list) ? raw.list : [];
    return {
      list,
      count: Number(raw?.count ?? list.length) || 0,
      pageCount: Number(raw?.pageCount ?? 1) || 1,
    };
  };

  private toArray(value: unknown): string[] {
    if (Array.isArray(value)) return value.map(String);
    if (value === null || value === undefined || value === '') return [];
    return String(value).split(',').filter(Boolean);
  }

  // ── Images ──────────────────────────────────────────────────────────────
  private savedImages(row: any): AssignedImage[] {
    return (row?.mediaIds ?? []).map((m: any) => ({
      id: String(m?.id ?? ''),
      defaultUrl: m?.defaultUrl ?? '',
      thumbnailUrl: m?.thumbnailUrl ?? m?.defaultUrl ?? '',
    }));
  }

  images(row: any): AssignedImage[] {
    return this.edits().get(String(row?.id)) ?? this.savedImages(row);
  }

  isEdited(row: any): boolean {
    return this.edits().has(String(row?.id));
  }

  private setImages(row: any, next: AssignedImage[]): void {
    const id = String(row?.id);
    const same = this.sameIds(next, this.savedImages(row));
    this.edits.update((m) => {
      const copy = new Map(m);
      if (same) copy.delete(id);
      else copy.set(id, next);
      return copy;
    });
  }

  private sameIds(a: AssignedImage[], b: AssignedImage[]): boolean {
    return a.length === b.length && a.every((x, i) => x.id === b[i].id);
  }

  async addImages(row: any): Promise<void> {
    const current = this.images(row);
    if (current.length >= MAX_IMAGES) return;
    const ref = this.modal.open<MediaPickerModalComponent, MediaPickerConfig, Media | Media[] | undefined>(
      MediaPickerModalComponent,
      {
        size: 'xl',
        data: {
          contentTypes: ['image'],
          multiple: true,
          maxSelect: MAX_IMAGES,
          title: this.lang.instant('PRODUCTS.BULK_IMAGE_PAGE.PICK_TITLE'),
          preSelectedIds: current.map((i) => i.id),
        },
      },
    );
    const result = await ref.afterClosed();
    const picked = Array.isArray(result) ? result : result ? [result] : [];
    if (!picked.length) return;

    const next = [...current];
    for (const p of picked as Media[]) {
      if (!p?.id || next.some((m) => m.id === p.id)) continue;
      if (next.length >= MAX_IMAGES) break;
      next.push({
        id: p.id,
        defaultUrl: p.url?.defaultUrl ?? p.url?.original ?? '',
        thumbnailUrl: p.url?.thumbnail ?? p.url?.defaultUrl ?? '',
      });
    }
    this.setImages(row, next);
  }

  removeImage(row: any, index: number): void {
    this.setImages(row, this.images(row).filter((_, i) => i !== index));
  }

  hideBroken(event: Event): void {
    (event.target as HTMLImageElement).style.display = 'none';
  }

  // ── Save ────────────────────────────────────────────────────────────────
  async save(): Promise<void> {
    if (this.saving() || this.edits().size === 0) return;
    const payload = [...this.edits()].map(([productId, imgs]) => ({
      productId,
      mediaIds: imgs.map((i) => i.id),
    }));
    this.saving.set(true);
    try {
      const res: any = await this.products.bulkProductMedia(payload);
      if (res?.success) {
        this.toast.success(this.lang.instant('PRODUCTS.BULK_IMAGE_PAGE.SAVED'));
        this.edits.set(new Map());
        this.listPage?.refresh();
      } else {
        this.toast.error(res?.msg || this.lang.instant('PRODUCTS.BULK_IMAGE_PAGE.SAVE_FAILED'));
      }
    } catch (error) {
      await this.errorService.handleError(error);
    } finally {
      this.saving.set(false);
    }
  }

  async showAll(): Promise<void> {
    await this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { ids: null },
      queryParamsHandling: 'merge',
    });
    this.listPage?.refresh();
  }
}
