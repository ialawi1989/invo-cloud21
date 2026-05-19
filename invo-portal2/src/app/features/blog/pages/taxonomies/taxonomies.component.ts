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
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { withTranslations } from '@core/i18n/with-translations';
import { BreadcrumbsComponent } from '@shared/components/breadcrumbs/breadcrumbs.component';
import type { BreadcrumbItem } from '@shared/components/breadcrumbs/breadcrumbs.types';
import { SegmentedToggleComponent } from '@shared/components/segmented-toggle/segmented-toggle.component';
import { SearchDropdownComponent } from '@shared/components/dropdown/search-dropdown.component';
import { ToastService } from '@shared/components/toast/toast.service';
import { ModalService } from '@shared/modal/modal.service';

import { BLOG_API } from '../../services/blog-api';
import { BlogPost, BlogTaxonomy, TaxonomyType } from '../../services/blog.types';
import { TaxonomyFormModalComponent } from './taxonomy-form-modal.component';
import { EmptyStateComponent } from '../../components/empty-state.component';
import { generateSlug } from '../../utils/blog-utils';

type Tab = 'category' | 'tag' | 'hashtag';

@Component({
  selector: 'app-blog-taxonomies',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterModule,
    TranslateModule,
    BreadcrumbsComponent,
    SegmentedToggleComponent,
    SearchDropdownComponent,
    EmptyStateComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './taxonomies.component.html',
  styleUrl: './taxonomies.component.scss',
})
export class TaxonomiesComponent implements OnInit {
  private api        = inject(BLOG_API);
  private translate  = inject(TranslateService);
  private destroyRef = inject(DestroyRef);
  private toast      = inject(ToastService);
  private modal      = inject(ModalService);

  tab     = signal<Tab>('category');
  loading = signal<boolean>(false);
  rows    = signal<BlogTaxonomy[]>([]);

  // ── Tag-tab inline create ──────────────────────────────────────────
  newTag = signal<string>('');

  // ── Hashtag-tab filter ─────────────────────────────────────────────
  hashtagLang = signal<string>('');
  hashtagSort = signal<'usage' | 'name'>('usage');

  // Drag state for the categories list.
  draggingId = signal<string | null>(null);

  private i18nTick = signal(0);

  // ── Derived ─────────────────────────────────────────────────────────
  breadcrumbs = computed<BreadcrumbItem[]>(() => {
    this.i18nTick();
    return [
      { label: this.translate.instant('MENU.BLOG'), routerLink: '/blog/posts' },
      { label: this.translate.instant('BLOG.TAXONOMIES.TITLE') },
    ];
  });

  tabOptions = computed(() => {
    this.i18nTick();
    return [
      { value: 'category' as Tab, label: 'BLOG.TAXONOMIES.TAB_CATEGORIES' },
      { value: 'tag'      as Tab, label: 'BLOG.TAXONOMIES.TAB_TAGS' },
      { value: 'hashtag'  as Tab, label: 'BLOG.TAXONOMIES.TAB_HASHTAGS' },
    ];
  });

  filteredRows = computed(() => {
    const r = this.rows();
    if (this.tab() !== 'hashtag') return r;
    let out = r.slice();
    if (this.hashtagLang()) out = out.filter(t => !!t.translations[this.hashtagLang()]);
    out.sort((a, b) =>
      this.hashtagSort() === 'usage'
        ? b.usageCount - a.usageCount
        : a.slug.localeCompare(b.slug),
    );
    return out;
  });

  langOptions = computed(() => [
    { id: '',   label: this.translate.instant('BLOG.LIST.LANG_ALL') },
    { id: 'en', label: 'English' },
    { id: 'ar', label: 'العربية' },
  ]);
  sortOptions = computed(() => [
    { id: 'usage', label: this.translate.instant('BLOG.TAXONOMIES.SORT_USAGE') },
    { id: 'name',  label: this.translate.instant('BLOG.TAXONOMIES.SORT_NAME') },
  ]);
  idDisplay = (v: any) => v?.label ?? v ?? '';
  idCompare = (a: any, b: any) => (a?.id ?? a) === (b?.id ?? b);
  idToValue = (i: { id: string; label: string }) => i.id;

  constructor() {
    withTranslations('blog');
    this.translate.onLangChange.pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.i18nTick.update(n => n + 1));
    this.translate.onTranslationChange.pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.i18nTick.update(n => n + 1));
  }

  ngOnInit(): void { void this.reload(); }

  // ── Loading ─────────────────────────────────────────────────────────
  async reload(): Promise<void> {
    this.loading.set(true);
    try {
      const rows = await this.api.listTaxonomies({ taxonomyType: this.tab() as TaxonomyType });
      this.rows.set(rows);
    } finally {
      this.loading.set(false);
    }
  }

  setTab(t: Tab): void {
    this.tab.set(t);
    void this.reload();
  }

  nameOf(t: BlogTaxonomy, lang: string = 'en'): string {
    return t.translations[lang]?.name
        ?? Object.values(t.translations)[0]?.name
        ?? t.slug;
  }

  langsOf(t: BlogTaxonomy): string[] { return Object.keys(t.translations); }

  // ── Categories: edit / delete ───────────────────────────────────────
  async openForm(existing?: BlogTaxonomy): Promise<void> {
    const ref = this.modal.open<TaxonomyFormModalComponent, any, BlogTaxonomy | null>(
      TaxonomyFormModalComponent,
      {
        size: 'md',
        data: {
          taxonomyType: this.tab(),
          existing:     existing ? structuredClone(existing) : null,
        },
        closeOnBackdrop: false,
      },
    );
    const result = await ref.afterClosed();
    if (result) {
      this.toast.success('COMMON.SAVED_OK');
      await this.reload();
    }
  }

  async confirmDelete(t: BlogTaxonomy): Promise<void> {
    // Tags with usage are protected at this layer.
    if (this.tab() === 'tag' && t.usageCount > 0) {
      this.toast.error('BLOG.TAXONOMIES.TAG_IN_USE');
      return;
    }
    const msg = this.tab() === 'category' && t.postsCount > 0
      ? this.translate.instant('BLOG.TAXONOMIES.CONFIRM_DELETE_WITH_POSTS', { name: this.nameOf(t), count: t.postsCount })
      : this.translate.instant('BLOG.TAXONOMIES.CONFIRM_DELETE', { name: this.nameOf(t) });
    if (!window.confirm(msg)) return;
    try {
      await this.api.deleteTaxonomy(t.id);
      this.toast.success('COMMON.DELETED_OK');
      await this.reload();
    } catch (e: any) {
      this.toast.error('COMMON.DELETE_FAILED', e?.message);
    }
  }

  // ── Tags: inline add ────────────────────────────────────────────────
  async addTag(): Promise<void> {
    const name = this.newTag().trim();
    if (!name) return;
    const slug = generateSlug(name);
    try {
      await this.api.saveTaxonomy({
        taxonomyType:    'tag',
        defaultLanguage: 'en',
        slug,
        order:           0,
        image:           null,
        translations: {
          en: { name, slug },
        },
      });
      this.newTag.set('');
      this.toast.success('COMMON.SAVED_OK');
      await this.reload();
    } catch (e: any) {
      this.toast.error('COMMON.SAVE_FAILED', e?.message);
    }
  }

  // ── Categories: drag reorder ────────────────────────────────────────
  onDragStart(e: DragEvent, t: BlogTaxonomy): void {
    this.draggingId.set(t.id);
    e.dataTransfer?.setData('text/plain', t.id);
    e.dataTransfer!.effectAllowed = 'move';
  }
  onDragOver(e: DragEvent): void { e.preventDefault(); }
  async onDrop(e: DragEvent, target: BlogTaxonomy): Promise<void> {
    e.preventDefault();
    const sourceId = this.draggingId();
    this.draggingId.set(null);
    if (!sourceId || sourceId === target.id) return;

    const rows = this.rows().slice();
    const fromIdx = rows.findIndex(r => r.id === sourceId);
    const toIdx   = rows.findIndex(r => r.id === target.id);
    if (fromIdx < 0 || toIdx < 0) return;
    const [moved] = rows.splice(fromIdx, 1);
    rows.splice(toIdx, 0, moved);
    // Re-index 0..n.
    const reordered = rows.map((r, i) => ({ ...r, order: i }));
    this.rows.set(reordered);
    try {
      await this.api.reorderTaxonomies(reordered.map(r => ({ id: r.id, order: r.order })));
    } catch (e: any) {
      this.toast.error('COMMON.SAVE_FAILED', e?.message);
      await this.reload();
    }
  }

  // ── Hashtags drawer (posts using) ───────────────────────────────────
  postsForHashtag = signal<BlogPost[] | null>(null);
  expandedHashtagId = signal<string | null>(null);
  async toggleHashtag(t: BlogTaxonomy): Promise<void> {
    if (this.expandedHashtagId() === t.id) {
      this.expandedHashtagId.set(null);
      this.postsForHashtag.set(null);
      return;
    }
    this.expandedHashtagId.set(t.id);
    this.postsForHashtag.set(null);
    const posts = await this.api.postsUsingHashtag(t.id);
    this.postsForHashtag.set(posts);
  }

  setHashtagLang(v: any): void {
    const id = (v && typeof v === 'object' ? v.id : v) ?? '';
    this.hashtagLang.set(id);
  }
  setHashtagSort(v: any): void {
    const id = (v && typeof v === 'object' ? v.id : v) ?? 'usage';
    this.hashtagSort.set(id);
  }
}
