import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import {
  CdkDragDrop,
  DragDropModule,
  moveItemInArray,
} from '@angular/cdk/drag-drop';

import { withTranslations } from '@core/i18n/with-translations';
import type { BreadcrumbItem } from '@shared/components/breadcrumbs/breadcrumbs.types';
import { ListShellComponent } from '@shared/components/list-shell/list-shell.component';
import { ToastService } from '@shared/components/toast/toast.service';
import { ModalService } from '@shared/modal/modal.service';
import {
  ConfirmModalComponent,
  ConfirmModalData,
} from '@shared/modal/demo/confirm-modal.component';
import {
  QueryParamsService,
  ParamDef,
  IntCodec,
  intCodec,
  StringCodec,
} from '@shared/services/query-params.service';

import { ServiceManagementService } from '../../services/service.service';
import { Service } from '../../services/service.types';

/** URL state codecs — page/limit/search persist across reloads. */
const QP = {
  page:     { key: 'page',  codec: IntCodec }     as ParamDef<number>,
  pageSize: { key: 'limit', codec: intCodec(20) } as ParamDef<number>,
  search:   { key: 'q',     codec: StringCodec }  as ParamDef<string>,
};

/**
 * Settings → Service Management (list)
 *
 * Searchable / paginated list of service definitions (DineIn,
 * PickUp, Delivery, …). Supports drag-reorder via a "Reorder" toggle
 * in the toolbar: when on, rows render with CDK drag handles and the
 * "Apply" action persists the new order through `arrangeServices`.
 */
@Component({
  selector: 'app-service-management-list',
  standalone: true,
  imports: [CommonModule, RouterModule, TranslateModule, ListShellComponent, DragDropModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './service-management-list.component.html',
  styleUrl:    './service-management-list.component.scss',
})
export class ServiceManagementListComponent implements OnInit {
  private service    = inject(ServiceManagementService);
  private translate  = inject(TranslateService);
  private destroyRef = inject(DestroyRef);
  private router     = inject(Router);
  private qp         = inject(QueryParamsService);
  private toast      = inject(ToastService);
  private modal      = inject(ModalService);

  loading = signal<boolean>(false);
  rows    = signal<Service[]>([]);
  total   = signal<number>(0);

  search   = signal<string>('');
  page     = signal<number>(1);
  pageSize = signal<number>(20);

  /** Drag-reorder mode — toggling on swaps the table chrome for a
   *  draggable list with an "Apply" action. */
  reorderMode = signal<boolean>(false);

  private i18nTick = signal(0);

  breadcrumbs = computed<BreadcrumbItem[]>(() => {
    this.i18nTick();
    return [
      { label: this.translate.instant('SETTINGS.TITLE'),                routerLink: '/settings' },
      { label: this.translate.instant('SERVICE_MANAGEMENT.LIST.TITLE') },
    ];
  });

  pageCount = computed<number>(() => {
    const total = this.total();
    const limit = this.pageSize();
    return total > 0 ? Math.ceil(total / limit) : 1;
  });

  rangeLabel = computed<string>(() => {
    this.i18nTick();
    const total = this.total();
    if (total === 0) return '';
    const start = (this.page() - 1) * this.pageSize() + 1;
    const end   = Math.min(this.page() * this.pageSize(), total);
    return this.translate.instant('COMMON.PAGINATION_RANGE', { start, end, total });
  });

  constructor() {
    withTranslations('settings/service-management');
    this.translate.onTranslationChange
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.i18nTick.update((n) => n + 1));
    this.translate.onLangChange
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.i18nTick.update((n) => n + 1));
  }

  async ngOnInit(): Promise<void> {
    // Seed search/paging state from the URL so refresh / direct
    // links restore the same view.
    const p = this.qp.read(QP);
    this.page.set(p.page);
    this.pageSize.set(p.pageSize);
    this.search.set(p.search);
    await this.load();
  }

  edit(row: Service): void {
    if (this.reorderMode()) return;
    this.router.navigate(['/settings/service-management', row.id]);
  }
  addNew(): void {
    this.router.navigate(['/settings/service-management', 'new']);
  }

  private syncUrl(): void {
    this.qp.write(QP, {
      page:     this.page(),
      pageSize: this.pageSize(),
      search:   this.search(),
    });
  }

  async load(): Promise<void> {
    this.loading.set(true);
    try {
      const res = await this.service.getList({
        page:       this.page(),
        // Pull a generous page when reordering so the user can shuffle
        // the whole list at once; otherwise honour the normal page size.
        limit:      this.reorderMode() ? 999 : this.pageSize(),
        searchTerm: this.search().trim(),
      });
      // Order by `index` so the drag layout from the server holds.
      const sorted = [...res.list].sort((a, b) => a.index - b.index);
      this.rows.set(sorted);
      this.total.set(res.count);
    } finally {
      this.loading.set(false);
    }
  }

  // ─── Search + paging ────────────────────────────────────────────
  onSearch(value: string): void {
    this.search.set(value);
    this.page.set(1);
    this.syncUrl();
    void this.load();
  }
  clearSearch(): void {
    this.search.set('');
    this.page.set(1);
    this.syncUrl();
    void this.load();
  }
  goPrev(): void {
    if (this.page() <= 1) return;
    this.page.update((p) => p - 1);
    this.syncUrl();
    this.load();
  }
  goNext(): void {
    if (this.page() >= this.pageCount()) return;
    this.page.update((p) => p + 1);
    this.syncUrl();
    this.load();
  }

  // ─── Reorder mode ───────────────────────────────────────────────
  async enterReorder(): Promise<void> {
    this.reorderMode.set(true);
    // Re-fetch with the high limit so the user is reordering the
    // full set, not just the visible page.
    await this.load();
  }
  async cancelReorder(): Promise<void> {
    this.reorderMode.set(false);
    // Reload to restore the server-persisted order and the regular
    // page size.
    await this.load();
  }
  async applyReorder(): Promise<void> {
    try {
      const ok = await this.service.reorder(this.rows());
      if (!ok) throw new Error('save failed');
      this.toast.success('COMMON.SAVED_OK');
      this.reorderMode.set(false);
      await this.load();
    } catch (err: any) {
      this.toast.error('COMMON.SAVE_FAILED', err?.message);
    }
  }
  dropRow(ev: CdkDragDrop<Service[]>): void {
    if (ev.previousIndex === ev.currentIndex) return;
    const next = [...this.rows()];
    moveItemInArray(next, ev.previousIndex, ev.currentIndex);
    this.rows.set(next.map((s, i) => ({ ...s, index: i })));
  }

  // ─── Row actions ────────────────────────────────────────────────
  async deleteRow(row: Service, ev: Event): Promise<void> {
    ev.stopPropagation();
    if (row.default) return;
    const ref = this.modal.open<ConfirmModalComponent, ConfirmModalData, boolean>(
      ConfirmModalComponent,
      {
        size: 'sm',
        data: {
          title:   this.translate.instant('SERVICE_MANAGEMENT.LIST.DELETE_TITLE'),
          message: this.translate.instant('SERVICE_MANAGEMENT.LIST.DELETE_MESSAGE', { name: row.name || '—' }),
          confirm: this.translate.instant('COMMON.DELETE'),
          danger:  true,
        },
        closeOnBackdrop: false,
      },
    );
    if (!(await ref.afterClosed())) return;
    try {
      const ok = await this.service.delete(row.id);
      if (!ok) throw new Error('delete failed');
      this.toast.success('COMMON.DELETED_OK');
      await this.load();
    } catch (err: any) {
      this.toast.error('COMMON.SAVE_FAILED', err?.message);
    }
  }

  /** Translation key for a service type chip — mirrors the legacy
   *  uppercase + slug naming so existing en.json entries match. */
  typeLabel(t: Service['type']): string {
    return t ? `SERVICE_MANAGEMENT.TYPES.${typeKey(t)}` : '';
  }

  trackRow = (_: number, s: Service) => s.id || s.name;
}

function typeKey(t: string): string {
  return t.replace(/([A-Z])/g, '_$1').toUpperCase().replace(/^_/, '');
}
