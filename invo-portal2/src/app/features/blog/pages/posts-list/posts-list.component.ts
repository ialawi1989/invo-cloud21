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
import { Router, RouterModule } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { withTranslations } from '@core/i18n/with-translations';
import { PrivilegeService } from '@core/auth/privileges/privilege.service';
import { ListPageComponent } from '@shared/components/list-page/components/list-page.component';
import {
  TableColumn,
  FilterConfig,
  BulkActionConfig,
  EmptyStateConfig,
  ListQueryParams,
  ListResponse,
} from '@shared/components/list-page/interfaces/list-page.types';
import {
  ListCellTemplateDirective,
  ListRowActionsDirective,
} from '@shared/components/list-page/directives/list-template.directives';
import { DropdownMenuBtnComponent, DropdownMenuBtnItem } from '@shared/components/dropdown-menu-btn/dropdown-menu-btn.component';
import { SearchDropdownComponent } from '@shared/components/dropdown/search-dropdown.component';
import { ToastService } from '@shared/components/toast/toast.service';
import { ModalService } from '@shared/modal/modal.service';
import { ImportWizardComponent } from '@shared/components/import-wizard/import-wizard.component';
import type { ImportWizardConfig, ImportSummaryCounts } from '@shared/components/import-wizard/import-wizard.types';
import { buildBlogImportConfig } from './blog-import.config';

import { BLOG_API } from '../../services/blog-api';
import { BlogPost, BlogTaxonomy, BlogWriter, PostStatus } from '../../services/blog.types';
import { StatusBadgeComponent } from '../../components/status-badge.component';

// 'pending' and 'trash' are Wix-style status tabs the backend doesn't
// support yet — they filter + round-trip but return no rows until those
// statuses exist server-side.
const STATUS_OPTIONS = ['', 'published', 'draft', 'pending', 'scheduled', 'trash'] as const;
type StatusFilter = typeof STATUS_OPTIONS[number];

@Component({
  selector: 'app-blog-posts-list',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    TranslateModule,
    ListPageComponent,
    ListCellTemplateDirective,
    ListRowActionsDirective,
    DropdownMenuBtnComponent,
    SearchDropdownComponent,
    StatusBadgeComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './posts-list.component.html',
  styleUrl: './posts-list.component.scss',
})
export class PostsListComponent implements OnInit {
  private api        = inject(BLOG_API);
  private router     = inject(Router);
  private translate  = inject(TranslateService);
  private destroyRef = inject(DestroyRef);
  private toast      = inject(ToastService);
  private privilege  = inject(PrivilegeService);
  private modal      = inject(ModalService);

  /** Handle to the shared list-page so tab/language changes can trigger
   *  a reload (the dataSource reads our signals when it runs). */
  @ViewChild(ListPageComponent) listPage?: ListPageComponent<BlogPost>;

  // ── Local state (status tabs + language live outside the framework) ──
  statusTab = signal<StatusFilter>('');
  language  = signal<string>('');
  total     = signal<number>(0);
  /** Per-status counts for the tab badges — populated from the backend's
   *  `statusCounts` on each load (keys: all/published/draft/pending/scheduled/trash). */
  counts    = signal<Record<string, number>>({});
  /** Currently selected rows — drives which bulk actions are offered. */
  selected  = signal<BlogPost[]>([]);

  writers    = signal<BlogWriter[]>([]);
  categories = signal<BlogTaxonomy[]>([]);

  private i18nTick = signal(0);

  canManage = computed(() => this.privilege.check('blogSecurity.actions.managePosts.access'));

  // ── List-page configuration ─────────────────────────────────────────
  columns: TableColumn<BlogPost>[] = [];
  filters: FilterConfig[] = [];

  paginationConfig = { enabled: true, pageLimits: [15, 25, 50, 100], default: 15 };
  searchConfig     = { enabled: true, placeholder: '' };
  sortingConfig    = { enabled: true, defaultSort: { key: 'publishDate', direction: 'desc' as const } };

  /** Per-tab empty state (title + message + a primary action), matching
   *  the Wix placeholders. The framework's empty state supports one
   *  action; the secondary "Import posts" lives in More Actions. */
  emptyState = computed<EmptyStateConfig>(() => {
    this.i18nTick();
    const t = (k: string) => this.translate.instant(k);
    switch (this.statusTab()) {
      case 'draft':     return { title: t('BLOG.LIST.EMPTY_DRAFTS_TITLE'),    message: t('BLOG.LIST.EMPTY_DRAFTS_MSG'),    actionLabel: t('BLOG.LIST.CREATE_POST'), actionHandler: () => this.goNew() };
      case 'pending':   return { title: t('BLOG.LIST.EMPTY_PENDING_TITLE'),   message: t('BLOG.LIST.EMPTY_PENDING_MSG'),   actionLabel: t('BLOG.LIST.MA_ADD_WRITER'), actionHandler: () => this.comingSoon() };
      case 'scheduled': return { title: t('BLOG.LIST.EMPTY_SCHEDULED_TITLE'), message: t('BLOG.LIST.EMPTY_SCHEDULED_MSG'), actionLabel: t('BLOG.LIST.CREATE_POST'), actionHandler: () => this.goNew() };
      case 'trash':     return { title: t('BLOG.LIST.EMPTY_TRASH_TITLE'),     message: t('BLOG.LIST.EMPTY_TRASH_MSG') };
      default:          return { title: t('BLOG.LIST.EMPTY_ALL_TITLE'),       message: t('BLOG.LIST.EMPTY_ALL_MSG'),       actionLabel: t('BLOG.LIST.CREATE_POST'), actionHandler: () => this.goNew() };
    }
  });

  // ── Header chrome ───────────────────────────────────────────────────
  statusTabs = computed(() => {
    this.i18nTick();
    const labels: Record<StatusFilter, string> = {
      '':        'BLOG.LIST.TAB_ALL',
      published: 'BLOG.LIST.TAB_PUBLISHED',
      draft:     'BLOG.LIST.TAB_DRAFTS',
      pending:   'BLOG.LIST.TAB_PENDING',
      scheduled: 'BLOG.LIST.TAB_SCHEDULED',
      trash:     'BLOG.LIST.TAB_TRASH',
    };
    return STATUS_OPTIONS.map(s => ({ key: s, label: this.translate.instant(labels[s]) }));
  });

  languageOptions = computed(() => {
    this.i18nTick();
    return [
      { id: '',   label: '🌐 ' + this.translate.instant('BLOG.LIST.LANG_ALL') },
      { id: 'en', label: '🇺🇸 English' },
      { id: 'ar', label: '🇸🇦 العربية' },
    ];
  });
  supportedLangCount = computed(() => Math.max(1, this.languageOptions().length - 1));

  idDisplay = (v: any) => v?.label ?? v ?? '';
  idCompare = (a: any, b: any) => (a?.id ?? a) === (b?.id ?? b);
  idToValue = (item: { id: string; label: string }) => item.id;
  /** Resolve the bound language id back to its label (the dropdown's
   *  value is the raw id, so a plain displayWith would show it blank). */
  langDisplay = (v: any) => {
    const id = v?.id ?? v;
    return this.languageOptions().find(o => o.id === id)?.label ?? '';
  };

  constructor() {
    withTranslations('blog');
    this.translate.onLangChange.pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => { this.i18nTick.update(n => n + 1); this.buildColumns(); });
    this.translate.onTranslationChange.pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => { this.i18nTick.update(n => n + 1); this.buildColumns(); });
  }

  async ngOnInit(): Promise<void> {
    this.buildColumns();
    void this.api.listWriters().then(rows => { this.writers.set(rows); this.buildFilters(); });
    void this.api.listTaxonomies({ taxonomyType: 'category' }).then(rows => { this.categories.set(rows); this.buildFilters(); });
  }

  private buildColumns(): void {
    const t = (k: string) => this.translate.instant(k);
    this.columns = [
      { key: 'title',         label: t('BLOG.LIST.COL_POST'),         sortable: true,  primary: true, locked: true, customTemplate: true },
      { key: 'publishDate',   label: t('BLOG.LIST.COL_DATE'),         sortable: true,  customTemplate: true },
      { key: 'translations',  label: t('BLOG.LIST.COL_TRANSLATIONS'), sortable: false, customTemplate: true, noApi: true },
      { key: 'views',         label: t('BLOG.LIST.COL_VIEWS'),        sortable: true,  customTemplate: true },
      { key: 'commentsCount', label: t('BLOG.LIST.COL_COMMENTS'),     sortable: false, customTemplate: true },
      { key: 'likesCount',    label: t('BLOG.LIST.COL_LIKES'),        sortable: true,  customTemplate: true },
      { key: 'taxonomyIds',   label: t('BLOG.LIST.COL_CATEGORIES'),   sortable: false, customTemplate: true, noApi: true },
    ];
  }

  private buildFilters(): void {
    const t = (k: string) => this.translate.instant(k);
    this.filters = [
      { key: 'datePeriod', label: t('BLOG.LIST.COL_DATE'), type: 'date-preset' },
      {
        key: 'authorEmployeeId', label: t('BLOG.LIST.COL_AUTHOR'), type: 'dropdown',
        options: this.writers().map(w => ({ value: w.id, label: w.name })),
      },
      {
        key: 'taxonomyId', label: t('BLOG.LIST.COL_CATEGORIES'), type: 'dropdown',
        options: this.categories().map(c => ({ value: c.id, label: c.translations?.['en']?.name ?? c.slug })),
      },
    ];
  }

  /** Resolve a date-preset filter value to a publish-date {from,to} window. */
  private resolvePeriod(period: unknown): { from?: string; to?: string } {
    if (!period) return {};
    const iso = (d: Date) => { const p = (n: number) => String(n).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`; };
    const s = String(period);
    if (s.startsWith('custom:')) {
      const [from, to] = s.slice(7).split('..');
      return { from: from || undefined, to: to || undefined };
    }
    const days: Record<string, number> = { last7: 7, last14: 14, last30: 30 };
    const n = days[s];
    if (!n) return {};
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const start = new Date(today); start.setDate(start.getDate() - (n - 1));
    return { from: iso(start), to: iso(today) };
  }

  // ── Data source (read by the list-page on every load) ───────────────
  loadPosts = async (params: ListQueryParams): Promise<ListResponse<BlogPost>> => {
    const period = this.resolvePeriod(params.filter?.['datePeriod']);
    const res = await this.api.listPosts({
      page:             params.page,
      limit:            params.limit,
      search:           params.searchTerm || undefined,
      sortBy:           params.sortBy?.sortValue as any,
      sortDir:          params.sortBy?.sortDirection,
      authorEmployeeId: params.filter?.['authorEmployeeId'] || undefined,
      taxonomyId:       params.filter?.['taxonomyId'] || undefined,
      dateFrom:         period.from,
      dateTo:           period.to,
      // 'pending'/'trash' aren't in PostListParams['status'] yet (stubs).
      status:           (this.statusTab() || undefined) as any,
      language:         this.language() || undefined,
    });
    this.total.set(res.count);
    // Per-status counts so every tab shows a badge (not just the active one).
    if (res.statusCounts) this.counts.set(res.statusCounts);
    return { list: res.list, count: res.count, pageCount: res.pageCount };
  };

  /** Badge number for a tab — from backend `statusCounts` when available,
   *  otherwise the live total for the currently-active tab only. */
  tabCount(key: StatusFilter): number {
    const sc = this.counts();
    const mapKey = key === '' ? 'all' : key;
    if (sc && mapKey in sc) return sc[mapKey] ?? 0;
    return this.statusTab() === key ? this.total() : 0;
  }

  // ── Bulk actions (vary by tab — Trash gets "Delete permanently") ────
  bulkActions = computed<BulkActionConfig[]>(() => {
    this.i18nTick();
    const t = (k: string) => this.translate.instant(k);
    if (this.statusTab() === 'trash') {
      return [
        { id: 'restore', label: t('BLOG.LIST.BULK_RESTORE'), requiresSelection: true,
          handler: (rows: BlogPost[]) => this.bulkRestore(rows) },
        { id: 'deleteForever', label: t('BLOG.LIST.BULK_DELETE_FOREVER'), color: 'danger', requiresSelection: true,
          confirmMessage: t('BLOG.LIST.CONFIRM_DELETE_FOREVER'),
          handler: (rows: BlogPost[]) => this.bulkDeleteForever(rows) },
      ];
    }
    // Only offer a status change that actually applies to the selection.
    const sel = this.selected();
    const acts: BulkActionConfig[] = [];
    if (sel.some(p => p.status !== 'published')) {
      acts.push({ id: 'publish', label: t('BLOG.LIST.BULK_PUBLISH'), requiresSelection: true,
        handler: (rows: BlogPost[]) => this.bulkSetStatus(rows, 'publish') });
    }
    if (sel.some(p => p.status !== 'draft')) {
      acts.push({ id: 'draft', label: t('BLOG.LIST.BULK_REVERT'), requiresSelection: true,
        handler: (rows: BlogPost[]) => this.bulkSetStatus(rows, 'unpublish') });
    }
    acts.push({ id: 'trash', label: t('BLOG.LIST.BULK_TRASH'), color: 'danger', requiresSelection: true,
      confirmMessage: t('BLOG.LIST.CONFIRM_TRASH'),
      handler: (rows: BlogPost[]) => this.bulkTrash(rows) });
    return acts;
  });

  /** Single-request bulk status change (backend processes per-id). */
  private async bulkStatus(rows: BlogPost[], status: PostStatus, okKey: string): Promise<void> {
    const ids = rows.map(r => r.id);
    if (!ids.length) return;
    try { await this.api.bulkUpdateStatus(ids, status); this.toast.success(okKey); }
    catch (e: any) { this.toast.error('COMMON.SAVE_FAILED', e?.message); }
    this.listPage?.clearSelection();
    this.listPage?.refresh();
  }
  private bulkSetStatus(rows: BlogPost[], action: 'publish' | 'unpublish'): void {
    void this.bulkStatus(
      rows,
      action === 'publish' ? 'published' : 'draft',
      action === 'publish' ? 'BLOG.LIST.PUBLISHED_OK' : 'BLOG.LIST.UNPUBLISHED_OK',
    );
  }
  private bulkTrash(rows: BlogPost[]): void { void this.bulkStatus(rows, 'trash', 'BLOG.LIST.TRASHED_OK'); }
  private bulkRestore(rows: BlogPost[]): void { void this.bulkStatus(rows, 'draft', 'BLOG.LIST.RESTORED_OK'); }
  private async bulkDeleteForever(rows: BlogPost[]): Promise<void> {
    const ids = rows.map(r => r.id);
    if (!ids.length) return;
    try { await this.api.bulkDelete(ids); this.toast.success('COMMON.DELETED_OK'); }
    catch (e: any) { this.toast.error('COMMON.DELETE_FAILED', e?.message); }
    this.listPage?.clearSelection();
    this.listPage?.refresh();
  }

  // ── Tabs / language ─────────────────────────────────────────────────
  setTab(key: StatusFilter): void {
    if (this.statusTab() === key) return;
    this.statusTab.set(key);
    this.reloadFromFirstPage();
  }
  setLanguage(v: any): void {
    this.language.set((v && typeof v === 'object' ? v.id : v) ?? '');
    this.reloadFromFirstPage();
  }
  /** Reset to page 1 and reload. We can't use `goToPage(1)` because it
   *  early-returns when the previous (empty) tab left `pageCount = 0`,
   *  which would strand the table on stale/empty data. */
  private reloadFromFirstPage(): void {
    const lp = this.listPage;
    if (!lp) return;
    lp.currentPage.set(1);
    lp.loadData();
  }

  // ── Row helpers ─────────────────────────────────────────────────────
  titleOf(p: BlogPost): string {
    const tr = p.translations;
    if (tr && typeof tr === 'object') {
      const fromMap = tr[p.defaultLanguage]?.title ?? Object.values(tr)[0]?.title;
      if (fromMap) return fromMap;
    }
    return (p as any).title ?? (p as any).name ?? '(untitled)';
  }
  languagesOf(p: BlogPost): string[] {
    const tr = p.translations;
    if (tr && typeof tr === 'object') return Object.keys(tr);
    const avail = (p as any).availableLanguages;
    if (Array.isArray(avail)) return avail;
    return p.defaultLanguage ? [p.defaultLanguage] : [];
  }
  translationsLabel(p: BlogPost): string {
    const total = p.supportedLanguages?.length ?? this.supportedLangCount();
    return `${this.languagesOf(p).length}/${total}`;
  }
  whenLabel(p: BlogPost): string {
    if (p.status === 'scheduled' && p.scheduledDate) return new Date(p.scheduledDate).toLocaleString();
    if (p.publishDate) return new Date(p.publishDate).toLocaleDateString();
    return '—';
  }
  categoriesOf(p: BlogPost): string {
    const ids = Array.isArray(p.taxonomyIds) ? p.taxonomyIds : [];
    if (!ids.length) return '—';
    const byId = new Map(this.categories().map(c => [c.id, c]));
    const names = ids
      .map(id => byId.get(id))
      .filter((c): c is BlogTaxonomy => !!c)
      .map(c => c.translations?.['en']?.name ?? c.slug);
    return names.length ? names.join(', ') : '—';
  }

  // ── Navigation / actions ────────────────────────────────────────────
  goNew(): void { this.router.navigate(['/blog/posts/new']); }
  goEdit(p: BlogPost): void { this.router.navigate(['/blog/posts', p.id, 'edit']); }
  /** Copy the post's public URL (built from its slug + language). */
  shareRow(p: BlogPost): void {
    const lang = p.defaultLanguage || 'en';
    const slug = (p as any).slug || p.id;
    const url = `/${lang}/blog/${slug}`;
    navigator.clipboard?.writeText(url)
      .then(() => this.toast.success('BLOG.LIST.LINK_COPIED'))
      .catch(() => this.toast.info('BLOG.LIST.COMING_SOON'));
  }
  onRowClick(e: { row: BlogPost }): void { this.goEdit(e.row); }

  async duplicate(p: BlogPost): Promise<void> {
    try { await this.api.duplicatePost(p.id); this.toast.success('BLOG.LIST.DUPLICATED_OK', this.titleOf(p)); this.listPage?.refresh(); }
    catch (e: any) { this.toast.error('COMMON.SAVE_FAILED', e?.message); }
  }
  async togglePublish(p: BlogPost): Promise<void> {
    try {
      if (p.status === 'published') { await this.api.unpublishPost(p.id); this.toast.success('BLOG.LIST.UNPUBLISHED_OK'); }
      else { await this.api.publishPost(p.id); this.toast.success('BLOG.LIST.PUBLISHED_OK'); }
      this.listPage?.refresh();
    } catch (e: any) { this.toast.error('COMMON.SAVE_FAILED', e?.message); }
  }
  /** Soft delete — moves to Trash (reversible). */
  async moveToTrash(p: BlogPost): Promise<void> {
    try { await this.api.trashPost(p.id); this.toast.success('BLOG.LIST.TRASHED_OK'); this.listPage?.refresh(); }
    catch (e: any) { this.toast.error('COMMON.SAVE_FAILED', e?.message); }
  }
  async restore(p: BlogPost): Promise<void> {
    try { await this.api.restorePost(p.id); this.toast.success('BLOG.LIST.RESTORED_OK'); this.listPage?.refresh(); }
    catch (e: any) { this.toast.error('COMMON.SAVE_FAILED', e?.message); }
  }
  /** Permanent delete (from Trash) — irreversible, asks first. */
  async confirmDelete(p: BlogPost): Promise<void> {
    const ok = window.confirm(this.translate.instant('BLOG.LIST.CONFIRM_DELETE', { title: this.titleOf(p) }));
    if (!ok) return;
    try { await this.api.deletePost(p.id); this.toast.success('COMMON.DELETED_OK'); this.listPage?.refresh(); }
    catch (e: any) { this.toast.error('COMMON.DELETE_FAILED', e?.message); }
  }

  async togglePin(p: BlogPost): Promise<void> {
    try {
      await this.api.pinPost(p.id, !p.isPinned);
      this.toast.success(p.isPinned ? 'BLOG.LIST.UNPINNED_OK' : 'BLOG.LIST.PINNED_OK');
      this.listPage?.refresh();
    } catch (e: any) { this.toast.error('COMMON.SAVE_FAILED', e?.message); }
  }

  private comingSoon(): void { this.toast.info('BLOG.LIST.COMING_SOON'); }

  /** Import posts (CSV / paste) via the shared import wizard. */
  async openImport(): Promise<void> {
    const cfg = buildBlogImportConfig({ api: this.api, translate: this.translate, defaultLang: this.language() || 'en' });
    const ref = this.modal.open<ImportWizardComponent, ImportWizardConfig, ImportSummaryCounts | undefined>(
      ImportWizardComponent,
      { size: 'lg', data: cfg, closeOnBackdrop: false },
    );
    const res = await ref.afterClosed();
    if (res?.successful) this.listPage?.refresh();
  }

  /** Import from a WordPress export (.xml / WXR) or a Markdown bundle
   *  (.zip) — uploaded straight to the backend, which parses it. */
  importFromFile(): void {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.xml,.zip';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      const name = file.name.toLowerCase();
      const source = name.endsWith('.xml') ? 'wxr' : name.endsWith('.zip') ? 'markdown-zip' : '';
      const fd = new FormData();
      fd.append('file', file);
      if (source) fd.append('source', source);
      try {
        const res = await this.api.importPosts(fd);
        this.toast.success('BLOG.IMPORT.DONE', String(res.imported ?? 0));
        this.listPage?.refresh();
      } catch (e: any) {
        this.toast.error('COMMON.SAVE_FAILED', e?.message);
      }
    };
    input.click();
  }

  /** Header "More Actions" dropdown. */
  moreActionsMenu(): DropdownMenuBtnItem[] {
    return [
      { label: 'BLOG.LIST.MA_CREATE_CATEGORY', click: () => this.router.navigate(['/blog/categories']), iconPath: 'M3 3h7v7H3z M14 3h7v7h-7z M14 14h7v7h-7z M3 14h7v7H3z' },
      { label: 'BLOG.LIST.MA_IMPORT',          click: () => this.openImport(), iconPath: 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4 M7 10l5 5 5-5 M12 15V3' },
      { label: 'BLOG.LIST.MA_IMPORT_FILE',     click: () => this.importFromFile(), iconPath: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z M14 2v6h6 M9 13h6 M9 17h6' },
      { label: 'BLOG.LIST.MA_REPORTS',         click: () => this.router.navigate(['/blog/analytics']), separator: true, iconPath: 'M3 3v18h18 M7 16V9 M12 16V5 M17 16v-3' },
      { label: 'BLOG.LIST.MA_SETTINGS',        click: () => this.router.navigate(['/blog/settings']), iconPath: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z' },
    ];
  }

  /** Per-row "⋯ More" menu — supported actions are live, Wix extras stub. */
  rowMenu(p: BlogPost): DropdownMenuBtnItem[] {
    const items: DropdownMenuBtnItem[] = [
      { label: 'BLOG.LIST.MENU_VIEW',         click: () => this.comingSoon(), iconPath: 'M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z' },
      { label: 'BLOG.LIST.MENU_SHARE',        click: () => this.comingSoon(), iconPath: 'M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8 M16 6l-4-4-4 4 M12 2v13' },
      { label: p.isPinned ? 'BLOG.LIST.MENU_UNPIN' : 'BLOG.LIST.MENU_PIN', click: () => this.togglePin(p), iconPath: 'M12 17v5 M5 17h14l-1.5-9H6.5z M9 8V5a3 3 0 0 1 6 0v3' },
      { label: 'BLOG.LIST.MENU_REPORT',       click: () => this.comingSoon(), iconPath: 'M3 3v18h18 M7 16V9 M12 16V5 M17 16v-3' },
      { label: 'BLOG.LIST.MENU_TRANSLATE',    click: () => this.comingSoon(), separator: true, iconPath: 'M2 12a10 10 0 1 0 20 0 10 10 0 1 0-20 0 M2 12h20 M12 2a15 15 0 0 1 0 20 15 15 0 0 1 0-20z' },
      { label: 'BLOG.LIST.MENU_CHANGE_LANG',  click: () => this.comingSoon(), iconPath: 'M21 2v6h-6 M3 12a9 9 0 0 1 15-6.7L21 8 M3 22v-6h6 M21 12a9 9 0 0 1-15 6.7L3 16' },
    ];
    if (this.canManage()) {
      const trashIcon = 'M3 6h18 M19 6l-2 14a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L5 6 M10 11v6 M14 11v6 M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2';
      if (this.statusTab() === 'trash') {
        items.push({ label: 'BLOG.LIST.BULK_RESTORE', click: () => this.restore(p), separator: true, iconPath: 'M3 7v6h6 M3 13a9 9 0 1 0 3-7.7L3 8' });
        items.push({ label: 'BLOG.LIST.BULK_DELETE_FOREVER', click: () => this.confirmDelete(p), danger: true, iconPath: trashIcon });
      } else {
        items.push({ label: 'BLOG.LIST.MENU_DUPLICATE', click: () => this.duplicate(p), separator: true, iconPath: 'M9 9h13v13H9z M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1' });
        if (p.status !== 'draft') {
          items.push({ label: 'BLOG.LIST.MENU_REVERT', click: () => this.togglePublish(p), iconPath: 'M3 7v6h6 M3 13a9 9 0 1 0 3-7.7L3 8' });
        }
        items.push({ label: 'BLOG.LIST.MENU_TRASH', click: () => this.moveToTrash(p), danger: true, separator: true, iconPath: trashIcon });
      }
    }
    return items;
  }
}
