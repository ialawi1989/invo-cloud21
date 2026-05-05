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

import { withTranslations } from '@core/i18n/with-translations';
import { BreadcrumbsComponent } from '@shared/components/breadcrumbs/breadcrumbs.component';
import type { BreadcrumbItem } from '@shared/components/breadcrumbs/breadcrumbs.types';
import { ModalService } from '@shared/modal/modal.service';
import { ConfirmModalComponent, ConfirmModalData } from '@shared/modal/demo/confirm-modal.component';

import { ReceiptBuilderService } from '../../services/receipt-builder.service';
import { ReceiptTemplateSummary, TemplateType } from '../../services/receipt-builder.types';
import {
  RenameTemplateModalComponent,
  RenameTemplateModalData,
} from './rename-template-modal/rename-template-modal.component';

/**
 * Receipt Builder → list page.
 *
 * Paginated, searchable table of templates. Add-new is a small split
 * dropdown (Receipt / Kitchen) since the same list shows both
 * template flavours. Row click opens the editor.
 *
 * Same conventions as menu-builder-list (signals + OnPush + custom
 * search/pager + ConfirmModal-driven delete).
 */
@Component({
  selector: 'app-receipt-builder-list',
  standalone: true,
  imports: [CommonModule, RouterModule, TranslateModule, BreadcrumbsComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './receipt-builder-list.component.html',
  styleUrl: './receipt-builder-list.component.scss',
})
export class ReceiptBuilderListComponent implements OnInit {
  private service    = inject(ReceiptBuilderService);
  private translate  = inject(TranslateService);
  private destroyRef = inject(DestroyRef);
  private router     = inject(Router);
  private modal      = inject(ModalService);

  loading = signal<boolean>(false);
  rows    = signal<ReceiptTemplateSummary[]>([]);
  total   = signal<number>(0);

  search   = signal<string>('');
  page     = signal<number>(1);
  pageSize = signal<number>(20);

  /** Show the small "+ Add" menu (Receipt / Kitchen). */
  addMenuOpen = signal<boolean>(false);

  private i18nTick = signal(0);
  private debounce?: ReturnType<typeof setTimeout>;

  breadcrumbs = computed<BreadcrumbItem[]>(() => {
    this.i18nTick();
    return [
      { label: this.translate.instant('SETTINGS.TITLE'),         routerLink: '/settings' },
      { label: this.translate.instant('RECEIPT_BUILDER.TITLE') },
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
    withTranslations('receipt-builder');
    this.translate.onTranslationChange.pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.i18nTick.update((n) => n + 1));
    this.translate.onLangChange.pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.i18nTick.update((n) => n + 1));
  }

  async ngOnInit(): Promise<void> { await this.load(); }

  async load(): Promise<void> {
    this.loading.set(true);
    try {
      const res = await this.service.getList({
        page:       this.page(),
        limit:      this.pageSize(),
        searchTerm: this.search().trim(),
      });
      this.rows.set(res.list);
      this.total.set(res.total);
    } finally {
      this.loading.set(false);
    }
  }

  // ─── Search + paging ────────────────────────────────────────────────
  onSearchInput(value: string): void {
    this.search.set(value);
    clearTimeout(this.debounce);
    this.debounce = setTimeout(() => {
      this.page.set(1);
      this.load();
    }, 300);
  }
  clearSearch(): void { this.search.set(''); this.page.set(1); this.load(); }
  goPrev(): void { if (this.page() > 1)             { this.page.update(p => p - 1); this.load(); } }
  goNext(): void { if (this.page() < this.pageCount()) { this.page.update(p => p + 1); this.load(); } }

  // ─── Navigation ─────────────────────────────────────────────────────
  edit(row: ReceiptTemplateSummary): void {
    this.router.navigate(['/settings/receipt-builder', row.id]);
  }
  /** "Add new" menu — pass `?type=` so the editor seeds the right
   *  template flavour (receipt vs kitchen). */
  addNew(type: TemplateType): void {
    this.addMenuOpen.set(false);
    this.router.navigate(['/settings/receipt-builder', 'new'], { queryParams: { type } });
  }

  toggleAddMenu(ev: Event): void {
    ev.stopPropagation();
    this.addMenuOpen.update((v) => !v);
  }
  /** Click anywhere else closes the dropdown. */
  closeAddMenu(): void { if (this.addMenuOpen()) this.addMenuOpen.set(false); }

  // ─── Row actions ────────────────────────────────────────────────────
  async removeRow(row: ReceiptTemplateSummary, ev: Event): Promise<void> {
    ev.stopPropagation();
    const ok = await this.confirm({
      title:   this.translate.instant('COMMON.DELETE'),
      message: this.translate.instant('RECEIPT_BUILDER.CONFIRM_DELETE', { name: row.name || '—' }),
      confirm: this.translate.instant('COMMON.DELETE'),
      danger:  true,
    });
    if (!ok) return;
    if (await this.service.deleteTemplate(row.id)) this.load();
  }

  /** Open the rename modal for `row`. The modal handles fetching the
   *  full template, swapping the name, and persisting; on close we
   *  patch the local row in place so the user sees the new name
   *  immediately without a full list refetch. */
  async renameRow(row: ReceiptTemplateSummary, ev: Event): Promise<void> {
    ev.stopPropagation();
    const ref = this.modal.open<
      RenameTemplateModalComponent,
      RenameTemplateModalData,
      { id: string; name: string } | undefined
    >(RenameTemplateModalComponent, {
      size: 'sm',
      data: { id: row.id, currentName: row.name },
      closeOnBackdrop: false,
    });
    const result = await ref.afterClosed();
    if (!result) return;
    this.rows.update((list) =>
      list.map((r) => (r.id === result.id ? { ...r, name: result.name } : r)),
    );
  }

  private async confirm(data: ConfirmModalData): Promise<boolean> {
    const ref = this.modal.open<ConfirmModalComponent, ConfirmModalData, boolean>(
      ConfirmModalComponent,
      { size: 'sm', data, closeOnBackdrop: false },
    );
    return (await ref.afterClosed()) === true;
  }
}
