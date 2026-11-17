import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal, viewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { withTranslations } from '@core/i18n/with-translations';
import type { BreadcrumbItem } from '@shared/components/breadcrumbs/breadcrumbs.types';
import { TooltipDirective } from '@shared/directives/tooltip.directive';
import { ModalService } from '@shared/modal/modal.service';
import { ConfirmModalComponent, ConfirmModalData } from '@shared/modal/demo/confirm-modal.component';
import { DropdownMenuBtnComponent, DropdownMenuBtnItem } from '@shared/components/dropdown-menu-btn/dropdown-menu-btn.component';
import { SegmentedToggleComponent, SegmentedToggleOption } from '@shared/components/segmented-toggle/segmented-toggle.component';
import { ListPageComponent } from '@shared/components/list-page/components/list-page.component';
import { ListCellTemplateDirective, ListRowActionsDirective } from '@shared/components/list-page/directives/list-template.directives';
import type { BulkActionConfig, ListQueryParams, TableColumn } from '@shared/components/list-page/interfaces/list-page.types';

import { LabelBuilderService } from '../../services/label-builder.service';
import { LabelTemplate, LabelTemplateSummary, LabelTemplateType } from '../../services/label-template.types';
import { LabelThumbnailComponent } from '../../components/label-thumbnail/label-thumbnail.component';
import { InViewDirective } from '../../components/in-view.directive';

type TypeFilter = 'all' | LabelTemplateType;

/**
 * Settings > Label templates, on the shared list page (search, paging, the type filter and selection all live in the shared table / URL).
 * `templateType: 'label'` = product labels, `'kitchen'` = kitchen tickets. A row opens the editor (registered top-level in `app.routes.ts`,
 * the canvas needs the room); its "..." menu has Edit, Rename, Duplicate and Delete; ticking rows offers Duplicate and Delete for all of them.
 */
@Component({
  selector: 'app-label-builder-list',
  standalone: true,
  imports: [
    CommonModule, RouterModule, FormsModule, TranslateModule, TooltipDirective, DropdownMenuBtnComponent, SegmentedToggleComponent,
    ListPageComponent, ListCellTemplateDirective, ListRowActionsDirective, LabelThumbnailComponent, InViewDirective,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './label-builder-list.component.html',
})
export class LabelBuilderListComponent {
  private service    = inject(LabelBuilderService);
  private translate  = inject(TranslateService);
  private router     = inject(Router);
  private route      = inject(ActivatedRoute);
  private modal      = inject(ModalService);
  private destroyRef = inject(DestroyRef);
  private listPage   = viewChild(ListPageComponent);

  /** Re-runs the translated computeds once the feature namespace has loaded. */
  private i18nTick = signal(0);

  /** Which type the toggle shows; mirrors the `type` URL param. */
  typeFilter = signal<TypeFilter>(this.readType(this.route.snapshot.queryParamMap.get('type')));
  private lastPageParam = this.route.snapshot.queryParamMap.get('page');

  /** The full templates the list response carried (or that were fetched when a row scrolled into view), for the thumbnails. */
  thumbCache = signal<Map<string, LabelTemplate>>(new Map());
  private fetching = new Set<string>();

  /** The row being renamed in place (double-click its name, or "Rename" in its menu). */
  renamingId  = signal<string | null>(null);
  renameDraft = signal('');

  constructor() {
    withTranslations('settings/label-builder');
    this.translate.onLangChange.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => this.i18nTick.update((n) => n + 1));
    this.translate.onTranslationChange.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => this.i18nTick.update((n) => n + 1));

    // Follow the address bar (back / forward, a pasted link). Subscribed before the list page, so `type` is already current
    // when the list page reloads for the same navigation.
    this.route.queryParamMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((q) => {
      const next = this.readType(q.get('type'));
      const page = q.get('page');
      const pageMoved = page !== this.lastPageParam;
      this.lastPageParam = page;
      if (next === this.typeFilter()) return;
      this.typeFilter.set(next);
      if (!pageMoved) queueMicrotask(() => this.listPage()?.refresh());
    });
  }

  private readType(v: string | null): TypeFilter { return v === 'label' || v === 'kitchen' ? v : 'all'; }
  private t = (k: string) => this.translate.instant(k);

  readonly typeFilterOptions: SegmentedToggleOption<TypeFilter>[] = [
    { value: 'all',     label: 'COMMON.ALL' },
    { value: 'label',   label: 'LABEL_BUILDER.TYPE.LABEL' },
    { value: 'kitchen', label: 'LABEL_BUILDER.TYPE.KITCHEN' },
  ];

  columns = computed<TableColumn[]>(() => {
    this.i18nTick();
    return [
      { key: 'name', label: this.t('LABEL_BUILDER.NAME'), primary: true, locked: true, customTemplate: true, visible: true, order: 0 },
      { key: 'templateType', label: this.t('LABEL_BUILDER.TYPE_COLUMN'), customTemplate: true, visible: true, order: 1 },
      { key: 'size', label: this.t('LABEL_BUILDER.SIZE'), customTemplate: true, visible: true, order: 2 },
      { key: 'dpi', label: this.t('LABEL_BUILDER.DPI'), customTemplate: true, visible: true, order: 3 },
      { key: 'updatedDate', label: this.t('LABEL_BUILDER.UPDATED'), customTemplate: true, visible: true, order: 4 },
    ];
  });

  breadcrumbs = computed<BreadcrumbItem[]>(() => {
    this.i18nTick();
    return [
      { label: 'Home', routerLink: '/', icon: 'home', iconOnly: true },
      { label: this.t('SETTINGS.TITLE'), routerLink: '/settings' },
      { label: this.t('LABEL_BUILDER.LIST_TITLE') },
    ] as BreadcrumbItem[];
  });

  readonly paginationConfig = { enabled: true, pageLimits: [15, 30, 60], default: 15 };
  readonly sortingConfig = { enabled: false };
  searchConfig = computed(() => { this.i18nTick(); return { enabled: true, placeholder: this.t('LABEL_BUILDER.SEARCH_PLACEHOLDER'), debounceMs: 500 }; });
  emptyState = computed(() => { this.i18nTick(); return { title: this.t('LABEL_BUILDER.LIST_EMPTY'), message: '', icon: 'box' }; });

  /** Ticked rows: duplicate or delete them all. */
  bulkActions = computed<BulkActionConfig[]>(() => {
    this.i18nTick();
    return [
      { id: 'duplicate', label: this.t('COMMON.DUPLICATE'), requiresSelection: true, handler: (rows: LabelTemplateSummary[]) => void this.duplicateMany(rows) },
      { id: 'delete', label: this.t('COMMON.DELETE'), color: 'danger', requiresSelection: true, handler: (rows: LabelTemplateSummary[]) => void this.deleteMany(rows) },
    ];
  });

  load = async (params: ListQueryParams) => {
    const type = this.typeFilter();
    const { list, total } = await this.service.getList({
      page: params.page, limit: params.limit, search: (params.searchTerm || '').trim(), type: type === 'all' ? undefined : type,
    });
    // The list response ships each template's elements, so the thumbnails need no extra request. A backend that leaves them out
    // falls back to fetching a row's template when it scrolls into view.
    const cache = new Map<string, LabelTemplate>();
    for (const row of list) {
      if (Array.isArray(row.template)) {
        const tpl = new LabelTemplate();
        tpl.ParseJson({ id: row.id, name: row.name, templateType: row.templateType, labelHeight: row.labelHeight, labelWidth: row.labelWidth, dpi: row.dpi, template: row.template });
        cache.set(row.id, tpl);
      }
    }
    this.thumbCache.set(cache);
    this.fetching.clear();
    return { list, count: total, pageCount: Math.max(1, Math.ceil(total / (params.limit || 15))) };
  };

  /** Picking a type writes it to the URL; `page: null` drops the page, so a new filter starts on page 1. */
  setTypeFilter(type: TypeFilter): void {
    if (this.typeFilter() === type) return;
    void this.router.navigate([], { relativeTo: this.route, queryParams: { type: type === 'all' ? null : type, page: null }, queryParamsHandling: 'merge' });
  }

  /** "+ New" asks which kind to start. */
  newMenuItems(): DropdownMenuBtnItem[] {
    return [
      { label: 'LABEL_BUILDER.NEW_LABEL',   click: () => this.newTemplate('label') },
      { label: 'LABEL_BUILDER.NEW_KITCHEN', click: () => this.newTemplate('kitchen') },
    ];
  }

  rowMenuItems(t: LabelTemplateSummary): DropdownMenuBtnItem[] {
    return [
      { label: 'COMMON.EDIT',          click: () => this.openTemplate(t) },
      { label: 'LABEL_BUILDER.RENAME', click: () => this.startRename(t) },
      { label: 'COMMON.DUPLICATE',     click: () => void this.duplicateMany([t]) },
      { label: 'COMMON.DELETE', danger: true, separator: true, click: () => void this.deleteMany([t], true) },
    ];
  }

  /** The editor reads `?type=` on init to decide which token picker (product vs invoice line) shows first. */
  newTemplate(type: LabelTemplateType): void { void this.router.navigate(['/settings/label-builder', '0'], { queryParams: { type } }); }
  openTemplate(t: LabelTemplateSummary): void { void this.router.navigate(['/settings/label-builder', t.id]); }

  /** No server-side duplicate: fetch the full template, clear its id, add "(copy)" to the name and save it as a new row. */
  async duplicateMany(rows: LabelTemplateSummary[]): Promise<void> {
    if (!rows.length) return;
    const suffix = this.translate.instant('LABEL_BUILDER.DUPLICATE_SUFFIX');
    for (const t of rows) {
      const full = this.thumbCache().get(t.id) ?? (await this.service.getById(t.id));
      if (!full) continue;
      const copy = new LabelTemplate();
      copy.ParseJson(full.toJSON());
      copy.id = '';
      copy.name = `${full.name} ${suffix}`.trim();
      await this.service.save(copy);
    }
    this.listPage()?.clearSelection();
    this.listPage()?.refresh();
  }

  /** Asks first. The backend has no batch delete, so one request per template. */
  async deleteMany(rows: LabelTemplateSummary[], single = false): Promise<void> {
    if (!rows.length) return;
    const ok = await this.confirm({
      title: this.t('LABEL_BUILDER.DELETE_TITLE'),
      message: single ? this.translate.instant('LABEL_BUILDER.DELETE_MESSAGE', { name: rows[0].name }) : this.translate.instant('LABEL_BUILDER.BULK_DELETE_MESSAGE', { count: rows.length }),
      danger: true,
    });
    if (!ok) return;
    for (const t of rows) await this.service.delete(t.id);
    this.listPage()?.clearSelection();
    this.listPage()?.refresh();
  }

  // ─── Rename in place: Enter saves, Escape cancels, leaving the field saves ───
  startRename(t: LabelTemplateSummary): void {
    this.renamingId.set(t.id);
    this.renameDraft.set(t.name);
    // The input exists after the next render; select its text so typing replaces the name.
    setTimeout(() => { const el = document.querySelector<HTMLInputElement>('.lbl__item-rename'); el?.focus(); el?.select(); });
  }

  cancelRename(): void { this.renamingId.set(null); this.renameDraft.set(''); }

  async commitRename(t: LabelTemplateSummary): Promise<void> {
    if (this.renamingId() !== t.id) return;
    const next = this.renameDraft().trim();
    this.renamingId.set(null);
    if (!next || next === t.name) return;
    const full = this.thumbCache().get(t.id) ?? (await this.service.getById(t.id));
    if (!full) return;
    full.name = next;
    await this.service.save(full);
    this.listPage()?.refresh();
  }

  onRenameKeydown(e: KeyboardEvent, t: LabelTemplateSummary): void {
    if (e.key === 'Enter') { e.preventDefault(); void this.commitRename(t); }
    else if (e.key === 'Escape') { e.preventDefault(); this.cancelRename(); }
  }

  // ─── Thumbnails ───
  thumbnail(id: string): LabelTemplate | null { return this.thumbCache().get(id) ?? null; }

  /** Fires when a row scrolls into view: fetches its template when the list did not carry it. */
  async onRowVisible(t: LabelTemplateSummary): Promise<void> {
    if (this.thumbCache().has(t.id) || this.fetching.has(t.id)) return;
    this.fetching.add(t.id);
    try {
      const full = await this.service.getById(t.id);
      if (full) this.thumbCache.update((prev) => new Map(prev).set(t.id, full));
    } catch {
      // The row keeps its placeholder thumbnail.
    } finally {
      this.fetching.delete(t.id);
    }
  }

  typeKey(t: LabelTemplateSummary): string {
    if (t.templateType === 'label') return 'LABEL_BUILDER.TYPE.LABEL';
    if (t.templateType === 'kitchen') return 'LABEL_BUILDER.TYPE.KITCHEN';
    return 'LABEL_BUILDER.TYPE.UNKNOWN';
  }

  private async confirm(data: ConfirmModalData): Promise<boolean> {
    const ref = this.modal.open<ConfirmModalComponent, ConfirmModalData, boolean>(ConfirmModalComponent, { size: 'sm', data, closeOnBackdrop: false });
    return (await ref.afterClosed()) === true;
  }
}
