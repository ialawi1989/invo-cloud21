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
import { Router, RouterModule } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { withTranslations } from '@core/i18n/with-translations';
import { DropdownMenuBtnComponent, DropdownMenuBtnItem } from '@shared/components/dropdown-menu-btn/dropdown-menu-btn.component';
import { SearchDropdownComponent } from '@shared/components/dropdown/search-dropdown.component';
import { ListSearchComponent } from '@shared/components/list-search/list-search.component';
import { ToastService } from '@shared/components/toast/toast.service';

import { BLOG_API } from '../../services/blog-api';
import {
  BlogComment,
  BlogPost,
  CommentListResult,
  CommentStatus,
} from '../../services/blog.types';
import { StatusBadgeComponent } from '../../components/status-badge.component';
import { HashtagTextComponent } from '../../components/hashtag-text.component';
import { EmptyStateComponent } from '../../components/empty-state.component';
import { timeAgo } from '../../utils/blog-utils';

type StatusTab = CommentStatus | 'all';

@Component({
  selector: 'app-blog-comments',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterModule,
    TranslateModule,
    DropdownMenuBtnComponent,
    SearchDropdownComponent,
    ListSearchComponent,
    StatusBadgeComponent,
    HashtagTextComponent,
    EmptyStateComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './comments.component.html',
  styleUrl: './comments.component.scss',
})
export class CommentsComponent implements OnInit {
  private api        = inject(BLOG_API);
  private translate  = inject(TranslateService);
  private destroyRef = inject(DestroyRef);
  private toast      = inject(ToastService);
  private router     = inject(Router);

  // ── Filter state ────────────────────────────────────────────────────
  statusTab = signal<StatusTab>('visible');
  postId    = signal<string>('');
  language  = signal<string>('');
  dateFrom  = signal<string>('');
  dateTo    = signal<string>('');
  search    = signal<string>('');

  // ── Data ────────────────────────────────────────────────────────────
  loading      = signal<boolean>(false);
  comments     = signal<BlogComment[]>([]);
  statusCounts = signal<Record<StatusTab, number>>({ all: 0, visible: 0, pending: 0, flagged: 0, deleted: 0 });
  postOptions  = signal<{ id: string; label: string }[]>([]);

  // ── Bulk selection + inline reply ───────────────────────────────────
  selected     = signal<Set<string>>(new Set());
  expandedReply = signal<string | null>(null);
  replyDraft    = signal<string>('');
  expandedView  = signal<Set<string>>(new Set());

  private i18nTick = signal(0);

  // ── Derived ─────────────────────────────────────────────────────────
  /** Wix-style status tabs (Published / Pending / Reported / Trash). */
  tabOptions = computed(() => {
    this.i18nTick();
    const c = this.statusCounts();
    return [
      { value: 'visible' as StatusTab, label: this.translate.instant('BLOG.COMMENTS.TAB_VISIBLE'), count: c.visible },
      { value: 'pending' as StatusTab, label: this.translate.instant('BLOG.COMMENTS.TAB_PENDING'), count: c.pending },
      { value: 'flagged' as StatusTab, label: this.translate.instant('BLOG.COMMENTS.TAB_FLAGGED'), count: c.flagged },
      { value: 'deleted' as StatusTab, label: this.translate.instant('BLOG.COMMENTS.TAB_DELETED'), count: c.deleted },
    ];
  });

  emptyMessage = computed(() => {
    this.i18nTick();
    switch (this.statusTab()) {
      case 'pending': return this.translate.instant('BLOG.COMMENTS.EMPTY_PENDING');
      case 'flagged': return this.translate.instant('BLOG.COMMENTS.EMPTY_FLAGGED');
      case 'deleted': return this.translate.instant('BLOG.COMMENTS.EMPTY_DELETED');
      case 'visible': return this.translate.instant('BLOG.COMMENTS.EMPTY_VISIBLE');
      default:        return this.translate.instant('BLOG.COMMENTS.EMPTY_ALL');
    }
  });
  emptyBody = computed(() => {
    this.i18nTick();
    switch (this.statusTab()) {
      case 'pending': return this.translate.instant('BLOG.COMMENTS.EMPTY_BODY_PENDING');
      case 'flagged': return this.translate.instant('BLOG.COMMENTS.EMPTY_BODY_FLAGGED');
      case 'deleted': return this.translate.instant('BLOG.COMMENTS.EMPTY_BODY_DELETED');
      case 'visible': return this.translate.instant('BLOG.COMMENTS.EMPTY_BODY_VISIBLE');
      default:        return this.translate.instant('BLOG.COMMENTS.EMPTY_BODY');
    }
  });

  /** Header "More Actions" dropdown → Comment settings. */
  moreActionsMenu(): DropdownMenuBtnItem[] {
    return [
      { label: 'BLOG.COMMENTS.COMMENT_SETTINGS', click: () => this.router.navigate(['/blog/settings']),
        iconPath: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z' },
    ];
  }
  openModerationRules(): void { void this.router.navigate(['/blog/comments/rules']); }

  langOptions = computed(() => {
    this.i18nTick();
    return [
      { id: '',   label: this.translate.instant('BLOG.LIST.LANG_ALL') },
      { id: 'en', label: 'English' },
      { id: 'ar', label: 'العربية' },
    ];
  });

  postOptionsForDropdown = computed(() => {
    this.i18nTick();
    return [{ id: '', label: this.translate.instant('BLOG.COMMENTS.ALL_POSTS') }, ...this.postOptions()];
  });

  idDisplay = (v: any) => v?.label ?? v ?? '';
  idCompare = (a: any, b: any) => (a?.id ?? a) === (b?.id ?? b);
  idToValue = (i: { id: string; label: string }) => i.id;

  allSelected = computed(() => {
    const c = this.comments();
    if (c.length === 0) return false;
    const sel = this.selected();
    return c.every(x => sel.has(x.id));
  });

  hasSelection = computed(() => this.selected().size > 0);

  constructor() {
    withTranslations('blog');
    this.translate.onLangChange.pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.i18nTick.update(n => n + 1));
    this.translate.onTranslationChange.pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.i18nTick.update(n => n + 1));
  }

  async ngOnInit(): Promise<void> {
    // Build the post selector from the post list (top 50 by date).
    const posts = await this.api.listPosts({ page: 1, limit: 50 });
    this.postOptions.set(posts.list.map(p => ({
      id: p.id,
      label: this.titleOf(p),
    })));
    await this.reload();
  }

  async reload(): Promise<void> {
    this.loading.set(true);
    this.selected.set(new Set());
    try {
      const res: CommentListResult = await this.api.listComments({
        status:   this.statusTab(),
        postId:   this.postId() || undefined,
        language: this.language() || undefined,
        search:   this.search() || undefined,
        dateFrom: this.dateFrom() || undefined,
        dateTo:   this.dateTo() || undefined,
        limit:    50,
      });
      this.comments.set(res.list);
      this.statusCounts.set(res.statusCounts);
    } catch (e: any) {
      this.toast.error('COMMON.LOAD_FAILED', e?.message);
    } finally {
      this.loading.set(false);
    }
  }

  // ── Filter handlers ─────────────────────────────────────────────────
  setTab(t: StatusTab): void { this.statusTab.set(t); void this.reload(); }
  setPost(v: any): void { this.postId.set((v && typeof v === 'object' ? v.id : v) ?? ''); void this.reload(); }
  setLang(v: any): void { this.language.set((v && typeof v === 'object' ? v.id : v) ?? ''); void this.reload(); }
  setSearch(v: string): void { this.search.set(v); void this.reload(); }
  clearSearch(): void { this.search.set(''); void this.reload(); }
  setDateFrom(v: string): void { this.dateFrom.set(v); void this.reload(); }
  setDateTo(v: string): void { this.dateTo.set(v); void this.reload(); }

  // ── Selection ───────────────────────────────────────────────────────
  toggleSelect(id: string, checked: boolean): void {
    const next = new Set(this.selected());
    if (checked) next.add(id); else next.delete(id);
    this.selected.set(next);
  }
  toggleSelectAll(checked: boolean): void {
    if (!checked) { this.selected.set(new Set()); return; }
    this.selected.set(new Set(this.comments().map(c => c.id)));
  }

  // ── Actions ─────────────────────────────────────────────────────────
  async approve(c: BlogComment): Promise<void> {
    try { await this.api.approveComment(c.id); this.toast.success('BLOG.COMMENTS.APPROVED_OK'); await this.reload(); }
    catch (e: any) { this.toast.error('COMMON.SAVE_FAILED', e?.message); }
  }
  async flag(c: BlogComment): Promise<void> {
    try { await this.api.flagComment(c.id); this.toast.success('BLOG.COMMENTS.FLAGGED_OK'); await this.reload(); }
    catch (e: any) { this.toast.error('COMMON.SAVE_FAILED', e?.message); }
  }
  async remove(c: BlogComment): Promise<void> {
    if (!window.confirm(this.translate.instant('BLOG.COMMENTS.CONFIRM_DELETE'))) return;
    try { await this.api.deleteComment(c.id); this.toast.success('BLOG.COMMENTS.TRASHED_OK'); await this.reload(); }
    catch (e: any) { this.toast.error('COMMON.DELETE_FAILED', e?.message); }
  }
  /** Trash tab — restore a deleted comment. */
  async restore(c: BlogComment): Promise<void> {
    try { await this.api.restoreComment(c.id); this.toast.success('BLOG.COMMENTS.RESTORED_OK'); await this.reload(); }
    catch (e: any) { this.toast.error('COMMON.SAVE_FAILED', e?.message); }
  }
  /** Trash tab — permanently delete (irreversible). */
  async deleteForever(c: BlogComment): Promise<void> {
    if (!window.confirm(this.translate.instant('BLOG.COMMENTS.CONFIRM_DELETE_FOREVER'))) return;
    try { await this.api.hardDeleteComment(c.id); this.toast.success('COMMON.DELETED_OK'); await this.reload(); }
    catch (e: any) { this.toast.error('COMMON.DELETE_FAILED', e?.message); }
  }

  // ── Bulk (single-request endpoints) ─────────────────────────────────
  async bulk(action: 'approve' | 'flag' | 'delete' | 'restore' | 'deleteForever'): Promise<void> {
    const ids = [...this.selected()];
    if (ids.length === 0) return;
    if (action === 'deleteForever' && !window.confirm(this.translate.instant('BLOG.COMMENTS.CONFIRM_BULK_DELETE', { count: ids.length }))) {
      return;
    }
    try {
      if (action === 'deleteForever') {
        await this.api.bulkDeleteComments(ids);
      } else {
        const status: CommentStatus =
          action === 'approve' ? 'visible'
          : action === 'flag'  ? 'flagged'
          : action === 'restore' ? 'visible'
          : 'deleted';
        await this.api.bulkUpdateCommentStatus(ids, status);
      }
      this.toast.success('BLOG.COMMENTS.BULK_DONE');
      await this.reload();
    } catch (e: any) {
      this.toast.error('COMMON.SAVE_FAILED', e?.message);
    }
  }

  // ── Reply ───────────────────────────────────────────────────────────
  openReply(c: BlogComment): void {
    if (this.expandedReply() === c.id) {
      this.expandedReply.set(null);
    } else {
      this.expandedReply.set(c.id);
      this.replyDraft.set('');
    }
  }
  async submitReply(parent: BlogComment): Promise<void> {
    const content = this.replyDraft().trim();
    if (!content) return;
    try {
      await this.api.replyToComment(parent.id, content);
      this.expandedReply.set(null);
      this.replyDraft.set('');
      this.toast.success('BLOG.COMMENTS.REPLY_SENT');
      await this.reload();
    } catch (e: any) {
      this.toast.error('COMMON.SAVE_FAILED', e?.message);
    }
  }

  // ── Helpers ─────────────────────────────────────────────────────────
  titleOf(p: BlogPost): string {
    return p.translations[p.defaultLanguage]?.title ?? Object.values(p.translations)[0]?.title ?? '(untitled)';
  }
  ago(c: BlogComment): string { return timeAgo(c.createdAt); }

  toggleView(id: string): void {
    const next = new Set(this.expandedView());
    if (next.has(id)) next.delete(id); else next.add(id);
    this.expandedView.set(next);
  }
  isExpanded(id: string): boolean { return this.expandedView().has(id); }

  /** Truncate to 200 chars unless the user expanded. */
  contentDisplay(c: BlogComment): string {
    if (this.isExpanded(c.id) || c.content.length <= 200) return c.content;
    return c.content.slice(0, 200) + '…';
  }
}
