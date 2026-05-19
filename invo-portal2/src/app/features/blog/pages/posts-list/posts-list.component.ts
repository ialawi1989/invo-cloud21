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
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { withTranslations } from '@core/i18n/with-translations';
import { PrivilegeService } from '@core/auth/privileges/privilege.service';
import { ListShellComponent } from '@shared/components/list-shell/list-shell.component';
import { SearchDropdownComponent } from '@shared/components/dropdown/search-dropdown.component';
import { ToastService } from '@shared/components/toast/toast.service';
import { ModalService } from '@shared/modal/modal.service';
import {
  QueryParamsService,
  StringCodec,
  IntCodec,
  enumCodec,
  ParamDef,
} from '@shared/services/query-params.service';

import { BLOG_API } from '../../services/blog-api';
import { BlogPost, BlogTaxonomy, BlogWriter, PostStatus } from '../../services/blog.types';
import { StatusBadgeComponent } from '../../components/status-badge.component';
import { EmptyStateComponent } from '../../components/empty-state.component';
import { timeAgo } from '../../utils/blog-utils';

const STATUS_OPTIONS = ['', 'draft', 'published', 'scheduled'] as const;
type StatusFilter = typeof STATUS_OPTIONS[number];

const SORT_OPTIONS = ['publishDate', 'views', 'title'] as const;
type SortField = typeof SORT_OPTIONS[number];

const PARAMS = {
  page:     { key: 'page',   codec: IntCodec } as ParamDef<number>,
  search:   { key: 'q',      codec: StringCodec } as ParamDef<string>,
  status:   { key: 'status', codec: enumCodec(STATUS_OPTIONS, '') } as ParamDef<StatusFilter>,
  language: { key: 'lang',   codec: StringCodec } as ParamDef<string>,
  author:   { key: 'author', codec: StringCodec } as ParamDef<string>,
  category: { key: 'cat',    codec: StringCodec } as ParamDef<string>,
  sort:     { key: 'sort',   codec: enumCodec(SORT_OPTIONS, 'publishDate') } as ParamDef<SortField>,
  dir:      { key: 'dir',    codec: enumCodec(['asc','desc'] as const, 'desc') } as ParamDef<'asc'|'desc'>,
};

const PAGE_SIZE = 15;

@Component({
  selector: 'app-blog-posts-list',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    TranslateModule,
    ListShellComponent,
    SearchDropdownComponent,
    StatusBadgeComponent,
    EmptyStateComponent,
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
  private qp         = inject(QueryParamsService);
  private toast      = inject(ToastService);
  private modal      = inject(ModalService);
  private privilege  = inject(PrivilegeService);

  // ── URL-backed filter state ─────────────────────────────────────────
  page     = signal<number>(1);
  search   = signal<string>('');
  status   = signal<StatusFilter>('');
  language = signal<string>('');
  author   = signal<string>('');
  category = signal<string>('');
  sort     = signal<SortField>('publishDate');
  dir      = signal<'asc'|'desc'>('desc');

  // ── Data ────────────────────────────────────────────────────────────
  loading   = signal<boolean>(false);
  posts     = signal<BlogPost[]>([]);
  total     = signal<number>(0);
  pageCount = signal<number>(1);
  error     = signal<boolean>(false);

  writers    = signal<BlogWriter[]>([]);
  categories = signal<BlogTaxonomy[]>([]);

  private i18nTick = signal(0);

  // ── Derived ─────────────────────────────────────────────────────────
  canManage = computed(() => this.privilege.check('blogSecurity.actions.managePosts.access'));

  rangeLabel = computed(() => {
    this.i18nTick();
    const t = this.total();
    if (t === 0) return '';
    const start = (this.page() - 1) * PAGE_SIZE + 1;
    const end   = Math.min(this.page() * PAGE_SIZE, t);
    return this.translate.instant('COMMON.PAGINATION_RANGE', { start, end, total: t });
  });

  statusOptions = computed(() => {
    this.i18nTick();
    return STATUS_OPTIONS.map(s => ({
      id: s,
      label: s === '' ? this.translate.instant('BLOG.LIST.STATUS_ALL') : this.translate.instant(`BLOG.STATUS.${s.toUpperCase()}`),
    }));
  });

  languageOptions = computed(() => {
    this.i18nTick();
    return [
      { id: '',   label: this.translate.instant('BLOG.LIST.LANG_ALL') },
      { id: 'en', label: 'English' },
      { id: 'ar', label: 'العربية' },
    ];
  });

  authorOptions = computed(() => {
    this.i18nTick();
    return [
      { id: '', label: this.translate.instant('BLOG.LIST.AUTHOR_ALL') },
      ...this.writers().map(w => ({ id: w.id, label: w.name })),
    ];
  });

  categoryOptions = computed(() => {
    this.i18nTick();
    const def = 'en';
    return [
      { id: '', label: this.translate.instant('BLOG.LIST.CATEGORY_ALL') },
      ...this.categories().map(c => ({
        id: c.id,
        label: c.translations[def]?.name ?? c.slug,
      })),
    ];
  });

  // Lightweight adapter set for app-search-dropdown.
  idDisplay = (v: any) => v?.label ?? v ?? '';
  idCompare = (a: any, b: any) => (a?.id ?? a) === (b?.id ?? b);
  idToValue = (item: { id: string; label: string }) => item.id;

  constructor() {
    withTranslations('blog');
    this.translate.onLangChange.pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.i18nTick.update(n => n + 1));
    this.translate.onTranslationChange.pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.i18nTick.update(n => n + 1));
  }

  async ngOnInit(): Promise<void> {
    const initial = this.qp.read(PARAMS);
    this.page.set(initial.page);
    this.search.set(initial.search);
    this.status.set(initial.status);
    this.language.set(initial.language);
    this.author.set(initial.author);
    this.category.set(initial.category);
    this.sort.set(initial.sort);
    this.dir.set(initial.dir);

    // Filter-feeding lookups load once.
    void this.api.listWriters().then(rows => this.writers.set(rows));
    void this.api.listTaxonomies({ taxonomyType: 'category' }).then(rows => this.categories.set(rows));

    await this.reload();
  }

  // ── Loading ─────────────────────────────────────────────────────────
  async reload(): Promise<void> {
    this.loading.set(true);
    this.error.set(false);
    try {
      const res = await this.api.listPosts({
        page:             this.page(),
        limit:            PAGE_SIZE,
        search:           this.search() || undefined,
        status:           this.status() || undefined,
        language:         this.language() || undefined,
        authorEmployeeId: this.author() || undefined,
        taxonomyId:       this.category() || undefined,
        sortBy:           this.sort(),
        sortDir:          this.dir(),
      });
      this.posts.set(res.list);
      this.total.set(res.count);
      this.pageCount.set(res.pageCount);
    } catch (e: any) {
      console.error('[blog/posts] load failed', e);
      this.error.set(true);
      this.toast.error('COMMON.LOAD_FAILED', e?.message);
    } finally {
      this.loading.set(false);
    }
  }

  private syncUrl(): void {
    this.qp.write(PARAMS, {
      page:     this.page(),
      search:   this.search(),
      status:   this.status(),
      language: this.language(),
      author:   this.author(),
      category: this.category(),
      sort:     this.sort(),
      dir:      this.dir(),
    });
  }

  // ── Filter handlers ─────────────────────────────────────────────────
  onSearch(v: string): void {
    this.search.set(v);
    this.page.set(1);
    this.syncUrl();
    void this.reload();
  }

  onClearSearch(): void {
    this.search.set('');
    this.page.set(1);
    this.syncUrl();
    void this.reload();
  }

  setFilter<K extends 'status'|'language'|'author'|'category'>(key: K, value: any): void {
    const id = (value && typeof value === 'object' ? value.id : value) ?? '';
    (this[key] as any).set(id);
    this.page.set(1);
    this.syncUrl();
    void this.reload();
  }

  prevPage(): void {
    if (this.page() <= 1) return;
    this.page.update(p => p - 1);
    this.syncUrl();
    void this.reload();
  }
  nextPage(): void {
    if (this.page() >= this.pageCount()) return;
    this.page.update(p => p + 1);
    this.syncUrl();
    void this.reload();
  }

  toggleSort(field: SortField): void {
    if (this.sort() === field) {
      this.dir.set(this.dir() === 'asc' ? 'desc' : 'asc');
    } else {
      this.sort.set(field);
      this.dir.set('desc');
    }
    this.syncUrl();
    void this.reload();
  }

  // ── Row helpers ─────────────────────────────────────────────────────
  titleOf(p: BlogPost): string {
    return p.translations[p.defaultLanguage]?.title
        ?? Object.values(p.translations)[0]?.title
        ?? '(untitled)';
  }
  languagesOf(p: BlogPost): string[] {
    return Object.keys(p.translations);
  }
  whenLabel(p: BlogPost): string {
    if (p.status === 'scheduled' && p.scheduledDate) return new Date(p.scheduledDate).toLocaleString();
    if (p.publishDate) return new Date(p.publishDate).toLocaleDateString();
    return '—';
  }
  ago(p: BlogPost): string {
    return timeAgo(p.updatedAt);
  }

  // ── Row actions ─────────────────────────────────────────────────────
  goNew(): void {
    this.router.navigate(['/blog/posts/new']);
  }
  goEdit(p: BlogPost): void {
    this.router.navigate(['/blog/posts', p.id, 'edit']);
  }

  async duplicate(p: BlogPost): Promise<void> {
    try {
      const copy = await this.api.duplicatePost(p.id);
      this.toast.success('BLOG.LIST.DUPLICATED_OK', this.titleOf(copy));
      await this.reload();
    } catch (e: any) {
      this.toast.error('COMMON.SAVE_FAILED', e?.message);
    }
  }

  async togglePublish(p: BlogPost): Promise<void> {
    try {
      if (p.status === 'published') {
        await this.api.unpublishPost(p.id);
        this.toast.success('BLOG.LIST.UNPUBLISHED_OK');
      } else {
        await this.api.publishPost(p.id);
        this.toast.success('BLOG.LIST.PUBLISHED_OK');
      }
      await this.reload();
    } catch (e: any) {
      this.toast.error('COMMON.SAVE_FAILED', e?.message);
    }
  }

  async confirmDelete(p: BlogPost): Promise<void> {
    const ok = window.confirm(this.translate.instant('BLOG.LIST.CONFIRM_DELETE', { title: this.titleOf(p) }));
    if (!ok) return;
    try {
      await this.api.deletePost(p.id);
      this.toast.success('COMMON.DELETED_OK');
      await this.reload();
    } catch (e: any) {
      this.toast.error('COMMON.DELETE_FAILED', e?.message);
    }
  }

  /** Polite icon for the sort header — empty when not active. */
  sortIcon(field: SortField): string {
    if (this.sort() !== field) return '';
    return this.dir() === 'asc' ? '▲' : '▼';
  }

  publishLabelFor(p: BlogPost): string {
    return p.status === 'published' ? 'BLOG.LIST.UNPUBLISH' : 'BLOG.LIST.PUBLISH';
  }
}
