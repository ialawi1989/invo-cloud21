import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  ViewChild,
  computed,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

import { withTranslations } from '@core/i18n/with-translations';
import type { BreadcrumbItem } from '@shared/components/breadcrumbs/breadcrumbs.types';
import { LoadingOverlayComponent } from '@shared/components/spinner/loading-overlay.component';
import { FormStickyFooterComponent } from '@shared/components/form-sticky-footer/form-sticky-footer.component';
import { ToastService } from '@shared/components/toast/toast.service';
import { ModalService } from '@shared/modal/modal.service';
import {
  ConfirmModalComponent,
  ConfirmModalData,
} from '@shared/modal/demo/confirm-modal.component';
import { ListPageComponent } from '@shared/components/list-page/components/list-page.component';
import { ListCellTemplateDirective } from '@shared/components/list-page/directives/list-template.directives';
import {
  TableColumn,
  ListQueryParams,
  SelectionChangeEvent,
  BulkActionConfig,
} from '@shared/components/list-page/interfaces/list-page.types';
import {
  BulkAvailabilityModalComponent,
  BulkAvailabilityData,
  BulkAvailabilityResult,
} from './components/bulk-availability-modal.component';
import { BranchSettingsService } from '../../../settings/services/branch-settings.service';

import { OptionService, OptionAvailabilityChange } from '../../services/option.service';

interface BranchCol { id: string; name: string; }

/** A list row: the option plus the branch ids it is NOT available in. */
interface AvailabilityRow {
  id: string;
  name: string;
  excludedBranches: string[];
}

/**
 * Option availability — a branch-per-column grid of checkboxes over the option
 * list. Ported from the legacy `option-availability` page.
 *
 * Built on the shared `<app-list-page>` so it inherits the same table chrome,
 * sticky first column, search, pagination and URL sync as every other list. The
 * branch columns are generated at runtime from the branch list, and each gets
 * its own `listCellTemplate` keyed by branch id.
 *
 * The model is exclusion-based: an option is available in a branch unless that
 * branch id sits in its `excludedBranches`. A ticked box therefore means
 * "absent from the exclusion set".
 *
 * Edits live in `edits`, keyed by option id, so they survive paging and search;
 * only touched rows are posted on save. The list owns the row data, so nothing
 * here mutates rows in place — `isAvailable()` consults `edits` first and falls
 * back to what the server returned.
 */
@Component({
  selector: 'app-option-availability',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    TranslateModule,
    LoadingOverlayComponent,
    FormStickyFooterComponent,
    ListPageComponent,
    ListCellTemplateDirective,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './option-availability.component.html',
  styleUrl: './option-availability.component.scss',
})
export class OptionAvailabilityComponent implements OnInit {
  private service = inject(OptionService);
  private branchService = inject(BranchSettingsService);
  private translate = inject(TranslateService);
  private destroyRef = inject(DestroyRef);
  private toast = inject(ToastService);
  private modal = inject(ModalService);

  /** The list owns the real selection; clearing our mirror alone would leave
   *  its floating action bar on screen. */
  @ViewChild(ListPageComponent) private listPage?: ListPageComponent;

  saving = signal(false);
  branches = signal<BranchCol[]>([]);

  /** Pending edits by option id — the single source of truth across pages. */
  private edits = signal<Map<string, Set<string>>>(new Map());
  readonly dirtyCount = computed(() => this.edits().size);

  /** Server-returned exclusions, cached by option id so a row that scrolls out
   *  of view can still be resolved when applying a bulk change. */
  private loaded = new Map<string, Set<string>>();

  selectedIds = signal<Set<string>>(new Set());

  private i18nTick = signal(0);

  paginationConfig = { enabled: true, pageLimits: [15, 25, 50, 100], default: 15 };
  searchConfig = { enabled: true, placeholder: '', debounceMs: 500 };

  emptyState = computed(() => {
    this.i18nTick();
    return { title: this.translate.instant('PRODUCTS.OPTIONS.EMPTY'), message: '' };
  });

  breadcrumbs = computed<BreadcrumbItem[]>(() => {
    this.i18nTick();
    return [
      { label: 'Home', routerLink: '/', icon: 'home' as const, iconOnly: true },
      { label: this.translate.instant('PRODUCTS.OPTIONS.TITLE'), routerLink: '/products/option' },
      { label: this.translate.instant('PRODUCTS.OPTIONS.AVAILABILITY.TITLE') },
    ];
  });

  /** Name column plus one column per branch, rebuilt when branches arrive. */
  columns = computed<TableColumn[]>(() => {
    this.i18nTick();
    const cols: TableColumn[] = [
      {
        key: 'name',
        label: this.translate.instant('PRODUCTS.OPTIONS.COL_NAME'),
        sortable: false,
        primary: true,
        locked: true,
        customTemplate: true,
        visible: true,
        order: 0,
      },
    ];
    this.branches().forEach((b, i) => {
      cols.push({
        key: b.id,
        label: b.name,
        sortable: false,
        align: 'center',
        customTemplate: true,
        visible: true,
        order: i + 1,
      });
    });
    return cols;
  });

  constructor() {
    withTranslations('products');
    this.translate.onLangChange
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.i18nTick.update((n) => n + 1));
  }

  async ngOnInit(): Promise<void> {
    this.searchConfig.placeholder = this.translate.instant('PRODUCTS.OPTIONS.SEARCH_PLACEHOLDER');
    await this.loadBranches();
  }

  private async loadBranches(): Promise<void> {
    const res = await this.branchService.getList({ page: 1, limit: 200 });
    this.branches.set(
      res.list
        .map((b: any) => ({ id: String(b?.id ?? ''), name: String(b?.name ?? '') }))
        // The legacy grid drops the synthetic "all" branch; it isn't a real store.
        .filter((b: BranchCol) => b.id && b.name.trim().toLowerCase() !== 'all')
        .sort((a: BranchCol, b: BranchCol) => a.name.localeCompare(b.name)),
    );
  }

  loadRows = async (params: ListQueryParams) => {
    const res = await this.service.getList({
      page: params.page,
      limit: params.limit,
      searchTerm: params.searchTerm || '',
    });
    const list: AvailabilityRow[] = res.list.map((o) => {
      const excluded = o.excludedBranches ?? [];
      this.loaded.set(o.id, new Set(excluded));
      return { id: o.id, name: o.name, excludedBranches: excluded };
    });
    return { list, count: res.count, pageCount: res.pageCount };
  };

  // ── Grid state ────────────────────────────────────────────────────────────
  /** Pending edit wins; otherwise whatever the server last returned. */
  private exclusionsFor(optionId: string): Set<string> {
    return this.edits().get(optionId) ?? this.loaded.get(optionId) ?? new Set<string>();
  }

  isAvailable(row: AvailabilityRow, branchId: string): boolean {
    return !this.exclusionsFor(row.id).has(branchId);
  }

  isDirty(row: AvailabilityRow): boolean {
    return this.edits().has(row.id);
  }

  toggle(row: AvailabilityRow, branchId: string): void {
    const next = new Set(this.exclusionsFor(row.id));
    if (next.has(branchId)) next.delete(branchId);
    else next.add(branchId);
    this.edits.update((m) => new Map(m).set(row.id, next));
  }

  // ── Selection / bulk apply ────────────────────────────────────────────────
  onSelectionChange(event: SelectionChangeEvent<AvailabilityRow>): void {
    this.selectedIds.set(new Set((event?.selectedRows ?? []).map((r) => r.id)));
  }

  clearSelection(): void {
    this.selectedIds.set(new Set());
    this.listPage?.clearSelection();
  }

  /** Surfaced in the list's own floating selection bar, like every other list. */
  readonly bulkActions = computed<BulkActionConfig[]>(() => {
    this.i18nTick();
    return [
      {
        id: 'perform-change',
        label: this.translate.instant('PRODUCTS.OPTIONS.AVAILABILITY.PERFORM_CHANGE'),
        handler: () => void this.openBulkChange(),
      },
    ];
  });

  /** "Perform change" — pick a branch (or all) and a state, apply to selection. */
  private async openBulkChange(): Promise<void> {
    const ids = [...this.selectedIds()];
    if (!ids.length) return;

    const ref = this.modal.open<BulkAvailabilityModalComponent, BulkAvailabilityData, BulkAvailabilityResult>(
      BulkAvailabilityModalComponent,
      { size: 'sm', data: { branches: this.branches(), count: ids.length } },
    );
    const result = await ref.afterClosed();
    if (!result) return;

    const targets = result.branchIds;
    if (!targets.length) return;

    const next = new Map(this.edits());
    for (const optionId of ids) {
      const set = new Set(this.exclusionsFor(optionId));
      for (const branchId of targets) {
        if (result.available) set.delete(branchId);
        else set.add(branchId);
      }
      next.set(optionId, set);
    }
    this.edits.set(next);
  }

  // ── Save ──────────────────────────────────────────────────────────────────
  async save(): Promise<void> {
    const changes: OptionAvailabilityChange[] = [...this.edits()].map(([id, excluded]) => ({
      id,
      excludedBranches: [...excluded],
    }));
    if (!changes.length) return;

    this.saving.set(true);
    try {
      const res = await this.service.setOptionAvailability(changes);
      if (res.success) {
        // Fold the saved state into the baseline so rows stop reading dirty.
        for (const [id, excluded] of this.edits()) this.loaded.set(id, new Set(excluded));
        this.edits.set(new Map());
        this.clearSelection();
        this.toast.success('COMMON.SAVED_OK');
      } else {
        this.toast.error('COMMON.SAVE_FAILED', res.msg);
      }
    } catch (e: any) {
      this.toast.error('COMMON.SAVE_FAILED', e?.message);
    } finally {
      this.saving.set(false);
    }
  }

  /**
   * Cancel discards the staged edits rather than leaving the page — the grid is
   * an editor, so Cancel is the counterpart to Save. Confirmed first: the edits
   * can span several pages of options and aren't recoverable once dropped.
   * Navigation stays available through the breadcrumb.
   */
  async discard(): Promise<void> {
    if (this.dirtyCount() === 0) return;
    const ref = this.modal.open<ConfirmModalComponent, ConfirmModalData, boolean>(
      ConfirmModalComponent,
      {
        size: 'sm',
        data: {
          title: this.translate.instant('PRODUCTS.OPTIONS.AVAILABILITY.DISCARD_TITLE'),
          message: this.translate.instant('PRODUCTS.OPTIONS.AVAILABILITY.DISCARD_MSG', {
            count: this.dirtyCount(),
          }),
          confirm: this.translate.instant('COMMON.DISCARD'),
          danger: true,
        },
      },
    );
    if (!(await ref.afterClosed())) return;
    this.edits.set(new Map());
    this.clearSelection();
  }
}
