import {
  ChangeDetectionStrategy,
  Component,
  HostListener,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

import { withTranslations } from '@core/i18n/with-translations';
import { LoadingOverlayComponent } from '@shared/components/spinner/loading-overlay.component';
import { SkeletonComponent } from '@shared/components/skeleton/skeleton.component';
import { TooltipDirective } from '@shared/directives/tooltip.directive';
import { ModalService } from '@shared/modal/modal.service';
import { ConfirmModalComponent, ConfirmModalData } from '@shared/modal/demo/confirm-modal.component';
import {
  DropdownMenuBtnComponent,
  DropdownMenuBtnItem,
} from '@shared/components/dropdown-menu-btn/dropdown-menu-btn.component';
import { ListShellComponent } from '@shared/components/list-shell/list-shell.component';
import {
  QueryParamsService,
  ParamDef,
  IntCodec,
  intCodec,
  StringCodec,
  enumCodec,
} from '@shared/services/query-params.service';

import { LabelBuilderService } from '../../services/label-builder.service';
import { LabelTemplate, LabelTemplateSummary, LabelTemplateType } from '../../services/label-template.types';

const TYPE_FILTERS = ['all', 'label', 'kitchen'] as const;
type TypeFilter = typeof TYPE_FILTERS[number];

const QP = {
  page:     { key: 'page',  codec: IntCodec }                            as ParamDef<number>,
  pageSize: { key: 'limit', codec: intCodec(15) }                        as ParamDef<number>,
  search:   { key: 'q',     codec: StringCodec }                         as ParamDef<string>,
  type:     { key: 'type',  codec: enumCodec(TYPE_FILTERS, 'all') }      as ParamDef<TypeFilter>,
};
import { LabelThumbnailComponent } from '../../components/label-thumbnail/label-thumbnail.component';
import { InViewDirective } from '../../components/in-view.directive';

/**
 * LabelBuilderListComponent
 * ─────────────────────────
 * Settings sub-page that lists every saved label template
 * (`templateType: 'label'` → product labels, `templateType: 'kitchen'` →
 * kitchen tickets). Mirrors the document-builder list pattern: per-
 * row overflow menu (Edit / Duplicate / Delete) + a split "New" button
 * that asks the user which template type to seed.
 *
 * The actual editor is registered top-level in `app.routes.ts` so it
 * takes over the viewport (the canvas needs the room).
 */
@Component({
  selector: 'app-label-builder-list',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    FormsModule,
    TranslateModule,
    LoadingOverlayComponent,
    SkeletonComponent,
    TooltipDirective,
    LabelThumbnailComponent,
    InViewDirective,
    DropdownMenuBtnComponent,
    ListShellComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './label-builder-list.component.html',
  styleUrl: './label-builder-list.component.scss',
})
export class LabelBuilderListComponent implements OnInit {
  private service   = inject(LabelBuilderService);
  private translate = inject(TranslateService);
  private router    = inject(Router);
  private modal     = inject(ModalService);
  private qp        = inject(QueryParamsService);

  constructor() { withTranslations('label-builder'); }

  loading   = signal<boolean>(false);
  templates = signal<LabelTemplateSummary[]>([]);

  /** Server-side pagination — page 1-based, fixed page size. Each
   *  filter change resets to page 1 and re-fetches; the visible list
   *  is always whatever the server returned for the current page. */
  page     = signal<number>(1);
  pageSize = signal<number>(15);
  total    = signal<number>(0);

  pageCount = computed<number>(() => {
    const t = this.total();
    const ps = this.pageSize();
    return t > 0 ? Math.ceil(t / ps) : 1;
  });

  /** "1–15 of 42" label below the list. Reads `i18nTick` so it
   *  re-renders on language switch without a full reload. */
  rangeLabel = computed<string>(() => {
    this.i18nTick();
    const t = this.total();
    if (t === 0) return '';
    const start = (this.page() - 1) * this.pageSize() + 1;
    const end   = Math.min(this.page() * this.pageSize(), t);
    return this.translate.instant('COMMON.PAGINATION_RANGE', { start, end, total: t });
  });

  /** Live search query bound to the list-header input. Filtering now
   *  runs server-side via the list endpoint's `searchTerm` so paging
   *  works against the filtered set — typing debounces 300ms before
   *  fetching to keep keystroke latency calm. */
  searchQuery = signal<string>('');

  /** Type filter — `all` shows everything, otherwise only labels or
   *  only kitchen tickets. Sent to the backend as `templateType`. */
  typeFilter  = signal<'all' | 'label' | 'kitchen'>('all');

  private i18nTick = signal(0);

  /** Backwards-compat alias used by the template — server-side
   *  paging means the visible list is already the filtered/paged
   *  view. Kept as a computed so existing template references keep
   *  working without churn. */
  filteredTemplates = computed<LabelTemplateSummary[]>(() => this.templates());

  /** Which row's overflow menu is currently open. `null` means none.
   *  Tracking it here (instead of per-row state) means opening one
   *  row's menu auto-closes any other. */
  openMenuId    = signal<string | null>(null);
  /** Items rendered in the header "+ New" `<app-dropdown-menu-btn>`. */
  newMenuItems(): DropdownMenuBtnItem[] {
    return [
      { label: 'LABEL_BUILDER.NEW_LABEL',   click: () => this.newTemplate('label')   },
      { label: 'LABEL_BUILDER.NEW_KITCHEN', click: () => this.newTemplate('kitchen') },
    ];
  }

  /** Items rendered in each row's `…` overflow menu. The synthetic
   *  Event is just a placeholder — handlers below only use it to
   *  stop propagation, which is already handled by the wrapper
   *  `<div (click)="$event.stopPropagation()">` in the template. */
  rowMenuItems(t: LabelTemplateSummary): DropdownMenuBtnItem[] {
    return [
      { label: 'COMMON.EDIT',          click: () => this.editTemplate(t, new Event('synthetic'))      },
      { label: 'LABEL_BUILDER.RENAME', click: () => this.startRename(t, new Event('synthetic'))       },
      { label: 'COMMON.DUPLICATE',     click: () => this.duplicateTemplate(t, new Event('synthetic')) },
      { label: 'COMMON.DELETE', danger: true, separator: true,
        click: () => this.deleteTemplate(t, new Event('synthetic')) },
    ];
  }

  /** Which row is currently in inline-rename mode. Null means none. */
  renamingId    = signal<string | null>(null);
  /** Working buffer for the inline rename input. Held separately so
   *  cancel can throw it away without touching the underlying row. */
  renameDraft   = signal<string>('');

  /** Set of selected template ids. A non-empty selection swaps the
   *  page header for a contextual bulk-action bar. */
  selectedIds   = signal<Set<string>>(new Set());

  /** Map of `id → fully-loaded template`. Populated lazily via the
   *  `appInView` event on each row — only rows the user actually
   *  scrolls past pay the round-trip cost. The signal is keyed by
   *  the same id `LabelTemplateSummary.id` carries so the row
   *  template can read `thumbCache().get(t.id)` without juggling. */
  thumbCache = signal<Map<string, LabelTemplate>>(new Map());

  /** Tracks ids we've already requested so a fast scroll up-and-
   *  down doesn't fire duplicate fetches before the first finishes. */
  private fetching = new Set<string>();

  /** No templates at all in the system — drives the "Create your
   *  first template" empty state. With server-side paging, "empty"
   *  means the server returned zero rows AND no filter is active.
   *  When a filter excludes everything we route to `isFilteredEmpty`
   *  instead so the user sees the Clear-filters affordance. */
  isEmpty            = computed<boolean>(() =>
    !this.loading() && this.templates().length === 0 && !this.hasActiveFilters());
  /** Filter active but the server returned no rows — "No matches" +
   *  a Clear-filters action. */
  isFilteredEmpty    = computed<boolean>(() =>
    !this.loading() && this.templates().length === 0 && this.hasActiveFilters());
  /** True whenever a filter is active — controls the visibility of
   *  the Clear-filters button. */
  hasActiveFilters   = computed<boolean>(() =>
    !!this.searchQuery().trim() || this.typeFilter() !== 'all');
  hasSelection = computed<boolean>(() => this.selectedIds().size > 0);
  /** Header checkbox tri-state — true when every visible row is
   *  selected, false otherwise. Operates on the filtered list so
   *  "select all" with an active search picks only what's visible
   *  (matches the convention in the products list). */
  allSelected  = computed<boolean>(() => {
    const list = this.filteredTemplates();
    if (!list.length) return false;
    const sel = this.selectedIds();
    return list.every(t => sel.has(t.id));
  });
  someSelected = computed<boolean>(() => {
    const sel = this.selectedIds();
    if (sel.size === 0) return false;
    return !this.allSelected();
  });

  clearFilters(): void {
    this.searchQuery.set('');
    this.typeFilter.set('all');
    this.reloadFromFirstPage();
  }

  /** Close any open popovers when the user clicks anywhere outside.
   *  Trigger wrappers in the template stop propagation so menu-
   *  internal clicks don't auto-close. */
  @HostListener('document:click')
  onDocumentClick(): void {
    if (this.openMenuId() !== null) this.openMenuId.set(null);
  }

  ngOnInit(): void {
    const p = this.qp.read(QP);
    this.page.set(p.page);
    this.pageSize.set(p.pageSize);
    this.searchQuery.set(p.search);
    this.typeFilter.set(p.type);
    void this.refresh();
  }

  private syncUrl(): void {
    this.qp.write(QP, {
      page:     this.page(),
      pageSize: this.pageSize(),
      search:   this.searchQuery(),
      type:     this.typeFilter(),
    });
  }

  async refresh(): Promise<void> {
    this.loading.set(true);
    try {
      const type = this.typeFilter();
      const { list, total } = await this.service.getList({
        page:   this.page(),
        limit:  this.pageSize(),
        search: this.searchQuery().trim(),
        type:   type === 'all' ? undefined : type,
      });
      this.templates.set(list);
      this.total.set(total);
      // Hydrate the thumb cache directly from the list response. The
      // upgraded list endpoint ships `template[]` inline so we don't
      // pay N round-trips to `/getLabelTemplate/:id` (one per row that
      // scrolls into view). Rows from a legacy backend that omit the
      // field still fall back to the per-row `onRowVisible` fetch.
      const next = new Map<string, LabelTemplate>();
      for (const row of list) {
        if (Array.isArray(row.template)) {
          const tpl = new LabelTemplate();
          tpl.ParseJson({
            id:           row.id,
            name:         row.name,
            templateType: row.templateType,
            labelHeight:  row.labelHeight,
            labelWidth:   row.labelWidth,
            dpi:          row.dpi,
            template:     row.template,
          });
          next.set(row.id, tpl);
        }
      }
      this.thumbCache.set(next);
      this.fetching.clear();
    } finally {
      this.loading.set(false);
    }
  }

  /** Reset to page 1 and re-fetch — used whenever a filter changes
   *  so the user doesn't end up on a page that no longer exists. */
  private reloadFromFirstPage(): void {
    this.page.set(1);
    this.syncUrl();
    void this.refresh();
  }

  /** Search submit — fired by `<app-list-search>` on Enter / button
   *  click. No debounce needed: the user has already committed. */
  onSearch(value: string): void {
    this.searchQuery.set(value);
    this.reloadFromFirstPage();
  }

  clearSearch(): void {
    this.searchQuery.set('');
    this.reloadFromFirstPage();
  }

  setTypeFilter(type: 'all' | 'label' | 'kitchen'): void {
    if (this.typeFilter() === type) return;
    this.typeFilter.set(type);
    this.reloadFromFirstPage();
  }

  goPrev(): void {
    if (this.page() <= 1 || this.loading()) return;
    this.page.update(p => p - 1);
    this.syncUrl();
    void this.refresh();
  }

  goNext(): void {
    if (this.page() >= this.pageCount() || this.loading()) return;
    this.page.update(p => p + 1);
    this.syncUrl();
    void this.refresh();
  }

  toggleMenu(id: string, event: Event): void {
    event.stopPropagation();
    this.openMenuId.set(this.openMenuId() === id ? null : id);
  }
  closeMenu(): void { this.openMenuId.set(null); }

  /** Send the user to the editor with `id=0` and the chosen seed
   *  type — the form reads `?type=` on init to decide which token
   *  picker (product vs invoiceLine) shows up by default. */
  newTemplate(type: LabelTemplateType): void {
    void this.router.navigate(['/settings/label-builder', '0'], {
      queryParams: { type },
    });
  }

  openTemplate(t: LabelTemplateSummary): void {
    void this.router.navigate(['/settings/label-builder', t.id]);
  }

  editTemplate(t: LabelTemplateSummary, event: Event): void {
    event.stopPropagation();
    this.closeMenu();
    this.openTemplate(t);
  }

  /** Client-side duplicate: fetch the full template, clear its id,
   *  append "(copy)" to the name, and save as a new row. The legacy
   *  back-end has no server-side duplicate, but `save()` with no id
   *  inserts, so this faithfully copies every field including the
   *  element array. */
  async duplicateTemplate(t: LabelTemplateSummary, event: Event): Promise<void> {
    event.stopPropagation();
    this.closeMenu();
    this.loading.set(true);
    try {
      // Prefer the inline template the list endpoint already loaded;
      // fall back to `getById` for older backend builds that don't
      // ship the element array on the list response.
      const full = this.thumbCache().get(t.id) ?? await this.service.getById(t.id);
      if (!full) return;
      const suffix = this.translate.instant('LABEL_BUILDER.DUPLICATE_SUFFIX');
      const copy = new LabelTemplate();
      copy.ParseJson(full.toJSON());
      copy.id = '';
      copy.name = `${full.name} ${suffix}`.trim();
      await this.service.save(copy);
      await this.refresh();
    } finally {
      this.loading.set(false);
    }
  }

  async deleteTemplate(t: LabelTemplateSummary, event: Event): Promise<void> {
    event.stopPropagation();
    this.closeMenu();
    const ok = await this.confirm({
      title:   this.translate.instant('LABEL_BUILDER.DELETE_TITLE'),
      message: this.translate.instant('LABEL_BUILDER.DELETE_MESSAGE', { name: t.name }),
      danger:  true,
    });
    if (!ok) return;
    await this.service.delete(t.id);
    void this.refresh();
  }

  // ─── Inline rename ─────────────────────────────────────────────
  //
  // Click the row's name to switch it into an editable input. Enter
  // saves, Escape cancels, blur saves (matches Slack/Notion pattern).
  // Avoids a full editor round-trip for cosmetic renames.

  startRename(t: LabelTemplateSummary, event: Event): void {
    event.stopPropagation();
    this.closeMenu();
    this.renamingId.set(t.id);
    this.renameDraft.set(t.name);
    // The input renders one CD cycle after the signal flips —
    // queueMicrotask runs after that cycle so `focus()` finds the
    // freshly-rendered input. `select()` highlights so the user can
    // type-replace immediately.
    queueMicrotask(() => {
      const el = document.querySelector<HTMLInputElement>('.lbl__item-rename');
      el?.focus();
      el?.select();
    });
  }

  cancelRename(): void {
    this.renamingId.set(null);
    this.renameDraft.set('');
  }

  async commitRename(t: LabelTemplateSummary): Promise<void> {
    if (this.renamingId() !== t.id) return;
    const next = this.renameDraft().trim();
    this.renamingId.set(null);
    if (!next || next === t.name) return; // no-op — user blurred without changes

    // Need the full template payload to call save(). Reuse the
    // inline copy hydrated from the list when available.
    this.loading.set(true);
    try {
      const full = this.thumbCache().get(t.id) ?? await this.service.getById(t.id);
      if (!full) return;
      full.name = next;
      await this.service.save(full);
      // Patch the local list optimistically so the UI updates without
      // a full refetch.
      this.templates.update(list =>
        list.map(row => row.id === t.id ? { ...row, name: next } : row),
      );
    } finally {
      this.loading.set(false);
    }
  }

  /** Capture Enter / Escape inside the rename input. */
  onRenameKeydown(event: KeyboardEvent, t: LabelTemplateSummary): void {
    if (event.key === 'Enter') {
      event.preventDefault();
      void this.commitRename(t);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      this.cancelRename();
    }
  }

  // ─── Multi-select ─────────────────────────────────────────────
  //
  // Per-row checkboxes drive a `selectedIds` set; a contextual bar
  // appears in the header zone when any are selected. Click bubbling
  // is stopped on the checkbox so toggling doesn't navigate into
  // the editor.

  isSelected(id: string): boolean { return this.selectedIds().has(id); }

  toggleRowSelection(t: LabelTemplateSummary, event: Event): void {
    event.stopPropagation();
    const next = new Set(this.selectedIds());
    if (next.has(t.id)) next.delete(t.id);
    else                next.add(t.id);
    this.selectedIds.set(next);
  }

  toggleSelectAll(event: Event): void {
    event.stopPropagation();
    const sel = this.selectedIds();
    // Operate on the filtered view — picking "select all" with an
    // active search shouldn't haul in hidden rows.
    const list = this.filteredTemplates();
    if (list.every(t => sel.has(t.id))) {
      // Deselect just the visible ones, keep any hidden selections.
      const next = new Set(sel);
      for (const t of list) next.delete(t.id);
      this.selectedIds.set(next);
    } else {
      const next = new Set(sel);
      for (const t of list) next.add(t.id);
      this.selectedIds.set(next);
    }
  }

  clearSelection(): void { this.selectedIds.set(new Set()); }

  /** Duplicate every selected template by fetching the full payload
   *  and saving with no id + a "(copy)" suffix on the name. Like
   *  bulk-delete: no server-side batch endpoint, so we fan out one
   *  fetch + save per id. Refresh once at the end and clear the
   *  selection so the user can keep working. */
  async duplicateSelectedBulk(): Promise<void> {
    const ids = Array.from(this.selectedIds());
    if (!ids.length) return;
    this.loading.set(true);
    const suffix = this.translate.instant('LABEL_BUILDER.DUPLICATE_SUFFIX');
    try {
      for (const id of ids) {
        const cached = this.thumbCache().get(id);
        const full = cached ?? await this.service.getById(id);
        if (!full) continue;
        const copy = new LabelTemplate();
        copy.ParseJson(full.toJSON());
        copy.id = '';
        copy.name = `${full.name} ${suffix}`.trim();
        await this.service.save(copy);
      }
      this.clearSelection();
      await this.refresh();
    } finally {
      this.loading.set(false);
    }
  }

  /** Confirm + delete every selected template. Done sequentially —
   *  the legacy back-end has no batch endpoint, so we fan out one
   *  request per id and refresh once at the end. Errors stop the
   *  loop early so a partial failure leaves a recognizable state. */
  async deleteSelected(): Promise<void> {
    const ids = Array.from(this.selectedIds());
    if (!ids.length) return;
    const ok = await this.confirm({
      title:   this.translate.instant('LABEL_BUILDER.DELETE_TITLE'),
      message: this.translate.instant('LABEL_BUILDER.BULK_DELETE_MESSAGE', { count: ids.length }),
      danger:  true,
    });
    if (!ok) return;

    this.loading.set(true);
    try {
      for (const id of ids) {
        await this.service.delete(id);
      }
      this.clearSelection();
      await this.refresh();
    } finally {
      this.loading.set(false);
    }
  }

  trackTemplate = (_: number, t: LabelTemplateSummary) => t.id;

  // ─── Lazy thumbnail hydration ─────────────────────────────────
  //
  // The list endpoint only returns summaries. Rendering a real
  // thumbnail needs the full element array, so we fetch it lazily
  // when the row scrolls into view (the directive fires once per
  // mount, so a re-scroll doesn't refire). Cached forever within
  // the component's lifetime — refresh() rebuilds the cache by
  // resetting the map.

  async onRowVisible(t: LabelTemplateSummary): Promise<void> {
    // Already hydrated (either from the inline list payload or from
    // a prior visibility fire) — nothing to do.
    if (this.thumbCache().has(t.id))   return;
    if (this.fetching.has(t.id))       return;
    // Fast-path: the row carries the full element array inline (new
    // list shape). Skip the network round-trip entirely.
    if (Array.isArray(t.template)) {
      const tpl = new LabelTemplate();
      tpl.ParseJson({
        id:           t.id,
        name:         t.name,
        templateType: t.templateType,
        labelHeight:  t.labelHeight,
        labelWidth:   t.labelWidth,
        dpi:          t.dpi,
        template:     t.template,
      });
      this.thumbCache.update(prev => {
        const next = new Map(prev);
        next.set(t.id, tpl);
        return next;
      });
      return;
    }
    this.fetching.add(t.id);
    try {
      const full = await this.service.getById(t.id);
      if (!full) return;
      // `signal.update` keeps the existing entries while adding the
      // new one — important for bulk-scrolled views where many
      // requests resolve in parallel.
      this.thumbCache.update(prev => {
        const next = new Map(prev);
        next.set(t.id, full);
        return next;
      });
    } catch {
      // Swallow — the row keeps showing the placeholder thumb,
      // which is acceptable. A retry would require viewport-exit
      // + re-entry, which is a fine UX.
    } finally {
      this.fetching.delete(t.id);
    }
  }

  /** Look up a cached full template by id for the row template. */
  thumbnail(id: string): LabelTemplate | null {
    return this.thumbCache().get(id) ?? null;
  }

  // (Aspect-ratio preview helpers were removed — the
  // `<app-label-thumbnail>` component now renders real scaled
  // previews and computes its own dimensions internally.)

  /** Friendly type label for the row chip — never throws on bad data
   *  because legacy rows can have empty `templateType`. */
  typeKey(t: LabelTemplateSummary): string {
    if (t.templateType === 'label')   return 'LABEL_BUILDER.TYPE.LABEL';
    if (t.templateType === 'kitchen') return 'LABEL_BUILDER.TYPE.KITCHEN';
    return 'LABEL_BUILDER.TYPE.UNKNOWN';
  }

  private async confirm(data: ConfirmModalData): Promise<boolean> {
    const ref = this.modal.open<ConfirmModalComponent, ConfirmModalData, boolean>(
      ConfirmModalComponent,
      { size: 'sm', data, closeOnBackdrop: false },
    );
    return (await ref.afterClosed()) === true;
  }
}
