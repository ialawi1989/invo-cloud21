import { Injectable } from '@angular/core';

import { BlogApi } from './blog-api';
import {
  BlogComment,
  BlogPost,
  BlogTaxonomy,
  BlogWriter,
  CommentListParams,
  CommentListResult,
  CommentStatus,
  PostListParams,
  PostListResult,
  PostSavePayload,
  PostStatus,
  TaxonomyListParams,
  TaxonomySavePayload,
  UploadResult,
} from './blog.types';
import {
  BlogSettingsRow,
  BlogSettingsTemplate,
  defaultBlogSettings,
} from './blog-settings.types';

/**
 * In-memory implementation of `BlogApi`. Seeded with realistic sample data
 * so the dashboard pages are fully interactive before the backend exists.
 *
 * State lives across a single browser session (a refresh resets it).
 * Network latency is simulated with a 200–500ms delay so loading states
 * are exercised in real use.
 */
@Injectable({ providedIn: 'root' })
export class BlogMockApi extends BlogApi {

  // ─── Storage ────────────────────────────────────────────────────────

  private posts:      BlogPost[]     = seedPosts();
  private taxonomies: BlogTaxonomy[] = seedTaxonomies();
  private comments:   BlogComment[]  = seedComments();
  private writers:    BlogWriter[]   = seedWriters();
  private settingsRow: BlogSettingsRow = seedSettings();

  // ─── Helpers ────────────────────────────────────────────────────────

  private delay<T>(value: T): Promise<T> {
    return new Promise(resolve => {
      setTimeout(() => resolve(value), 200 + Math.random() * 300);
    });
  }

  private clone<T>(v: T): T { return JSON.parse(JSON.stringify(v)); }

  private nextId(prefix: string): string {
    return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
  }

  private now(): string { return new Date().toISOString(); }

  // ─── Posts ──────────────────────────────────────────────────────────

  async listPosts(params: PostListParams): Promise<PostListResult> {
    let rows = this.posts.slice();

    if (params.status)           rows = rows.filter(p => p.status === params.status);
    if (params.taxonomyId)       rows = rows.filter(p => p.taxonomyIds.includes(params.taxonomyId!));
    if (params.authorEmployeeId) rows = rows.filter(p => p.authorEmployeeId === params.authorEmployeeId);

    if (params.language) {
      rows = rows.filter(p => !!p.translations[params.language!]);
    }
    if (params.search) {
      const q = params.search.toLowerCase();
      rows = rows.filter(p =>
        Object.values(p.translations).some(t =>
          t.title.toLowerCase().includes(q) ||
          t.excerpt.toLowerCase().includes(q) ||
          t.content.toLowerCase().includes(q),
        ),
      );
    }

    const sortBy  = params.sortBy  ?? 'publishDate';
    const sortDir = params.sortDir ?? 'desc';
    rows.sort((a, b) => {
      const dir = sortDir === 'asc' ? 1 : -1;
      if (sortBy === 'views') return (a.views - b.views) * dir;
      if (sortBy === 'title') {
        const at = a.translations[a.defaultLanguage]?.title ?? '';
        const bt = b.translations[b.defaultLanguage]?.title ?? '';
        return at.localeCompare(bt) * dir;
      }
      const ad = a.publishDate ?? a.scheduledDate ?? a.createdAt;
      const bd = b.publishDate ?? b.scheduledDate ?? b.createdAt;
      return (new Date(ad).getTime() - new Date(bd).getTime()) * dir;
    });

    const page  = Math.max(1, params.page  ?? 1);
    const limit = Math.max(1, params.limit ?? 15);
    const count = rows.length;
    const pageCount = Math.max(1, Math.ceil(count / limit));
    const slice = rows.slice((page - 1) * limit, page * limit);

    return this.delay({ list: this.clone(slice), count, pageCount });
  }

  async getPost(id: string): Promise<BlogPost | null> {
    const found = this.posts.find(p => p.id === id) ?? null;
    return this.delay(found ? this.clone(found) : null);
  }

  async savePost(payload: PostSavePayload): Promise<BlogPost> {
    const idx = payload.id ? this.posts.findIndex(p => p.id === payload.id) : -1;
    const writer = this.writers.find(w => w.id === payload.authorEmployeeId);

    if (idx >= 0) {
      const existing = this.posts[idx];
      const updated: BlogPost = {
        ...existing,
        ...payload,
        id:            existing.id,
        authorName:    writer?.name   ?? existing.authorName,
        authorAvatar:  writer?.avatar ?? existing.authorAvatar,
        readingTime:   payload.readingTime ?? existing.readingTime,
        commentsCount: existing.commentsCount,
        views:         existing.views,
        createdAt:     existing.createdAt,
        updatedAt:     this.now(),
      };
      this.posts[idx] = updated;
      return this.delay(this.clone(updated));
    }

    const created: BlogPost = {
      ...payload,
      id:            this.nextId('post'),
      authorName:    writer?.name   ?? 'Unknown',
      authorAvatar:  writer?.avatar ?? null,
      readingTime:   payload.readingTime ?? estimateReadingTime(payload.translations[payload.defaultLanguage]?.content ?? ''),
      views:         0,
      commentsCount: 0,
      createdAt:     this.now(),
      updatedAt:     this.now(),
    };
    this.posts = [created, ...this.posts];
    return this.delay(this.clone(created));
  }

  async deletePost(id: string): Promise<boolean> {
    const before = this.posts.length;
    this.posts = this.posts.filter(p => p.id !== id);
    this.comments = this.comments.filter(c => c.postId !== id);
    return this.delay(this.posts.length < before);
  }

  async publishPost(id: string): Promise<BlogPost> {
    return this.updateStatus(id, 'published', { publishDate: this.now() });
  }
  async unpublishPost(id: string): Promise<BlogPost> {
    return this.updateStatus(id, 'draft', { publishDate: null });
  }
  async schedulePost(id: string, scheduledDate: string): Promise<BlogPost> {
    return this.updateStatus(id, 'scheduled', { scheduledDate });
  }
  private async updateStatus(id: string, status: PostStatus, extra: Partial<BlogPost>): Promise<BlogPost> {
    const idx = this.posts.findIndex(p => p.id === id);
    if (idx < 0) throw new Error('Post not found');
    this.posts[idx] = { ...this.posts[idx], ...extra, status, updatedAt: this.now() };
    return this.delay(this.clone(this.posts[idx]));
  }

  async duplicatePost(id: string): Promise<BlogPost> {
    const src = this.posts.find(p => p.id === id);
    if (!src) throw new Error('Post not found');
    const translations: BlogPost['translations'] = {};
    for (const [lang, locale] of Object.entries(src.translations)) {
      translations[lang] = {
        ...locale,
        title: `${locale.title} (Copy)`,
        slug:  `${locale.slug}-copy-${Math.random().toString(36).slice(2, 5)}`,
      };
    }
    const copy: BlogPost = {
      ...this.clone(src),
      id:            this.nextId('post'),
      status:        'draft',
      publishDate:   null,
      scheduledDate: null,
      views:         0,
      commentsCount: 0,
      translations,
      createdAt:     this.now(),
      updatedAt:     this.now(),
    };
    this.posts = [copy, ...this.posts];
    return this.delay(this.clone(copy));
  }

  // ─── Taxonomies ─────────────────────────────────────────────────────

  async listTaxonomies(params: TaxonomyListParams): Promise<BlogTaxonomy[]> {
    let rows = this.taxonomies.filter(t => t.taxonomyType === params.taxonomyType);
    if (params.search) {
      const q = params.search.toLowerCase();
      rows = rows.filter(t =>
        t.slug.includes(q) ||
        Object.values(t.translations).some(l => l.name.toLowerCase().includes(q)),
      );
    }
    if (params.language) {
      rows = rows.filter(t => !!t.translations[params.language!]);
    }
    rows = rows.slice().sort((a, b) => a.order - b.order);
    return this.delay(this.clone(rows));
  }

  async getTaxonomy(id: string): Promise<BlogTaxonomy | null> {
    const found = this.taxonomies.find(t => t.id === id) ?? null;
    return this.delay(found ? this.clone(found) : null);
  }

  async saveTaxonomy(payload: TaxonomySavePayload): Promise<BlogTaxonomy> {
    const idx = payload.id ? this.taxonomies.findIndex(t => t.id === payload.id) : -1;
    if (idx >= 0) {
      this.taxonomies[idx] = {
        ...this.taxonomies[idx],
        ...payload,
        id:        this.taxonomies[idx].id,
        updatedAt: this.now(),
      };
      return this.delay(this.clone(this.taxonomies[idx]));
    }
    const created: BlogTaxonomy = {
      ...payload,
      id:         this.nextId('tax'),
      postsCount: 0,
      usageCount: 0,
      createdAt:  this.now(),
      updatedAt:  this.now(),
    };
    this.taxonomies = [...this.taxonomies, created];
    return this.delay(this.clone(created));
  }

  async deleteTaxonomy(id: string, reassignToId?: string | null): Promise<boolean> {
    if (reassignToId) {
      this.posts = this.posts.map(p => ({
        ...p,
        taxonomyIds: p.taxonomyIds.map(t => t === id ? reassignToId : t),
        mainTaxonomyId: p.mainTaxonomyId === id ? reassignToId : p.mainTaxonomyId,
      }));
    } else {
      this.posts = this.posts.map(p => ({
        ...p,
        taxonomyIds:    p.taxonomyIds.filter(t => t !== id),
        mainTaxonomyId: p.mainTaxonomyId === id ? null : p.mainTaxonomyId,
      }));
    }
    const before = this.taxonomies.length;
    this.taxonomies = this.taxonomies.filter(t => t.id !== id);
    return this.delay(this.taxonomies.length < before);
  }

  async reorderTaxonomies(order: { id: string; order: number }[]): Promise<boolean> {
    const map = new Map(order.map(o => [o.id, o.order]));
    this.taxonomies = this.taxonomies.map(t =>
      map.has(t.id) ? { ...t, order: map.get(t.id)!, updatedAt: this.now() } : t,
    );
    return this.delay(true);
  }

  async mergeTags(sourceId: string, targetId: string): Promise<boolean> {
    if (sourceId === targetId) return this.delay(false);
    this.posts = this.posts.map(p => ({
      ...p,
      taxonomyIds: Array.from(new Set(
        p.taxonomyIds.map(t => t === sourceId ? targetId : t),
      )),
    }));
    this.taxonomies = this.taxonomies.filter(t => t.id !== sourceId);
    return this.delay(true);
  }

  async postsUsingHashtag(hashtagId: string): Promise<BlogPost[]> {
    const tag = this.taxonomies.find(t => t.id === hashtagId && t.taxonomyType === 'hashtag');
    if (!tag) return this.delay([]);
    const name = tag.translations[tag.defaultLanguage]?.name?.toLowerCase() ?? tag.slug;
    const matches = this.posts.filter(p =>
      Object.values(p.translations).some(t => t.content.toLowerCase().includes(`#${name}`)),
    );
    return this.delay(this.clone(matches));
  }

  // ─── Comments ───────────────────────────────────────────────────────

  async listComments(params: CommentListParams): Promise<CommentListResult> {
    let rows = this.comments.slice();
    if (params.postId)   rows = rows.filter(c => c.postId === params.postId);
    if (params.language) rows = rows.filter(c => c.language === params.language);
    if (params.search) {
      const q = params.search.toLowerCase();
      rows = rows.filter(c => c.content.toLowerCase().includes(q) || c.authorName.toLowerCase().includes(q));
    }
    if (params.dateFrom) {
      const t = new Date(params.dateFrom).getTime();
      rows = rows.filter(c => new Date(c.createdAt).getTime() >= t);
    }
    if (params.dateTo) {
      const t = new Date(params.dateTo).getTime();
      rows = rows.filter(c => new Date(c.createdAt).getTime() <= t);
    }

    // Counts BEFORE status filter so the tab badges show totals across statuses.
    const all = this.comments.filter(c => {
      if (params.postId   && c.postId   !== params.postId)   return false;
      if (params.language && c.language !== params.language) return false;
      return true;
    });
    const statusCounts: CommentListResult['statusCounts'] = {
      all:      all.length,
      visible:  all.filter(c => c.status === 'visible').length,
      pending:  all.filter(c => c.status === 'pending').length,
      flagged:  all.filter(c => c.status === 'flagged').length,
      deleted:  all.filter(c => c.status === 'deleted').length,
    };

    if (params.status && params.status !== 'all') {
      rows = rows.filter(c => c.status === params.status);
    }

    rows.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    const page  = Math.max(1, params.page  ?? 1);
    const limit = Math.max(1, params.limit ?? 25);
    const count = rows.length;
    const pageCount = Math.max(1, Math.ceil(count / limit));
    const slice = rows.slice((page - 1) * limit, page * limit);

    return this.delay({ list: this.clone(slice), count, pageCount, statusCounts });
  }

  async approveComment(id: string): Promise<BlogComment> { return this.setCommentStatus(id, 'visible'); }
  async flagComment(id: string):    Promise<BlogComment> { return this.setCommentStatus(id, 'flagged'); }
  async deleteComment(id: string):  Promise<boolean> {
    const idx = this.comments.findIndex(c => c.id === id);
    if (idx < 0) return this.delay(false);
    this.comments[idx] = { ...this.comments[idx], status: 'deleted', updatedAt: this.now() };
    this.recountCommentsOnPost(this.comments[idx].postId);
    return this.delay(true);
  }

  private async setCommentStatus(id: string, status: CommentStatus): Promise<BlogComment> {
    const idx = this.comments.findIndex(c => c.id === id);
    if (idx < 0) throw new Error('Comment not found');
    this.comments[idx] = { ...this.comments[idx], status, updatedAt: this.now() };
    this.recountCommentsOnPost(this.comments[idx].postId);
    return this.delay(this.clone(this.comments[idx]));
  }

  async replyToComment(id: string, content: string): Promise<BlogComment> {
    const parent = this.comments.find(c => c.id === id);
    if (!parent) throw new Error('Parent comment not found');
    const employee = this.writers[0];
    const reply: BlogComment = {
      id:               this.nextId('cmt'),
      postId:           parent.postId,
      postTitle:        parent.postTitle,
      shopperId:        null,
      authorEmployeeId: employee?.id ?? 'emp_unknown',
      authorName:       employee?.name ?? 'Staff',
      authorAvatar:     employee?.avatar ?? null,
      authorKind:       'employee',
      content,
      parentCommentId:  parent.id,
      parentExcerpt:    parent.content.slice(0, 80),
      parentAuthor:     parent.authorName,
      status:           'visible',
      language:         parent.language,
      createdAt:        this.now(),
      updatedAt:        this.now(),
    };
    this.comments = [...this.comments, reply];
    this.recountCommentsOnPost(parent.postId);
    return this.delay(this.clone(reply));
  }

  private recountCommentsOnPost(postId: string): void {
    const count = this.comments.filter(c => c.postId === postId && c.status === 'visible').length;
    this.posts = this.posts.map(p => p.id === postId ? { ...p, commentsCount: count } : p);
  }

  // ─── Writers / Settings / Uploads ───────────────────────────────────

  async listWriters(): Promise<BlogWriter[]> {
    return this.delay(this.clone(this.writers));
  }

  async getSettings(): Promise<BlogSettingsRow> {
    return this.delay(this.clone(this.settingsRow));
  }

  async saveSettings(template: BlogSettingsTemplate, row: BlogSettingsRow): Promise<BlogSettingsRow> {
    this.settingsRow = {
      ...row,
      template: this.clone(template),
      id: row.id ?? this.nextId('bs'),
    };
    return this.delay(this.clone(this.settingsRow));
  }

  async upload(file: File): Promise<UploadResult> {
    // Mock uploader — returns a data URL so previews render immediately.
    const url: string = await new Promise(resolve => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.readAsDataURL(file);
    });
    return this.delay({ url });
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────

function estimateReadingTime(html: string): number {
  const words = stripHtml(html).split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 200));
}
function stripHtml(s: string): string { return s.replace(/<[^>]*>/g, ' '); }

// ─── Seed data ────────────────────────────────────────────────────────

function seedWriters(): BlogWriter[] {
  return [
    { id: 'emp_admin', name: 'Sarah Admin',  avatar: null, publicTitle: 'Editor in Chief' },
    { id: 'emp_dev',   name: 'Omar Devlin',  avatar: null, publicTitle: 'Tech Writer' },
    { id: 'emp_mkt',   name: 'Lina Marketer', avatar: null, publicTitle: 'Marketing' },
  ];
}

function seedTaxonomies(): BlogTaxonomy[] {
  const now = new Date().toISOString();
  const cat = (slug: string, order: number, en: string, ar: string, postsCount: number): BlogTaxonomy => ({
    id: `tax_${slug}`, taxonomyType: 'category', defaultLanguage: 'en',
    slug, order, image: null, postsCount, usageCount: postsCount,
    translations: {
      en: { name: en, slug, description: '' },
      ar: { name: ar, slug, description: '' },
    },
    createdAt: now, updatedAt: now,
  });
  const tag = (slug: string, usage: number): BlogTaxonomy => ({
    id: `tax_${slug}`, taxonomyType: 'tag', defaultLanguage: 'en',
    slug, order: 0, image: null, postsCount: 0, usageCount: usage,
    translations: {
      en: { name: slug, slug },
      ar: { name: slug, slug },
    },
    createdAt: now, updatedAt: now,
  });
  const hashtag = (slug: string, usage: number): BlogTaxonomy => ({
    id: `tax_h_${slug}`, taxonomyType: 'hashtag', defaultLanguage: 'en',
    slug, order: 0, image: null, postsCount: 0, usageCount: usage,
    translations: {
      en: { name: slug, slug },
      ar: { name: slug, slug },
    },
    createdAt: now, updatedAt: now,
    lastUsedAt: now,
  });
  return [
    cat('tech',      0, 'Tech',      'تقنية',   2),
    cat('news',      1, 'News',      'أخبار',   2),
    cat('tutorials', 2, 'Tutorials', 'دروس',    2),
    tag('guide',       3),
    tag('review',      2),
    tag('announcement', 1),
    tag('tips',        4),
    tag('feature',     2),
    hashtag('launch',  3),
    hashtag('howto',   5),
    hashtag('release', 2),
  ];
}

function seedPosts(): BlogPost[] {
  const day = (offset: number) => new Date(Date.now() + offset * 86400000).toISOString();
  const post = (
    id: string,
    status: PostStatus,
    en: { title: string; excerpt: string; content: string },
    ar: { title: string; excerpt: string; content: string },
    extras: Partial<BlogPost>,
  ): BlogPost => ({
    id, defaultLanguage: 'en', status,
    authorEmployeeId: 'emp_admin',
    authorName: 'Sarah Admin', authorAvatar: null,
    coverImage: null, ogImage: null,
    mainTaxonomyId: null,
    isFeatured: false,
    publishDate: null, scheduledDate: null,
    readingTime: 3, views: 0, commentsCount: 0,
    translations: {
      en: { title: en.title, slug: slugify(en.title), excerpt: en.excerpt, content: en.content },
      ar: { title: ar.title, slug: slugify(en.title), excerpt: ar.excerpt, content: ar.content },
    },
    taxonomyIds: [],
    createdAt: day(-30), updatedAt: day(-1),
    ...extras,
  });
  return [
    post('post_welcome', 'published',
      { title: 'Welcome to our blog', excerpt: 'A short intro to what you can expect.', content: '<p>Hello world! #launch</p>' },
      { title: 'مرحباً بكم في مدونتنا', excerpt: 'مقدمة سريعة لما يمكنكم توقعه.', content: '<p>مرحباً بالعالم! #launch</p>' },
      { publishDate: day(-7), views: 482, commentsCount: 4, isFeatured: true,
        mainTaxonomyId: 'tax_news', taxonomyIds: ['tax_news', 'tax_announcement'], authorEmployeeId: 'emp_admin', readingTime: 2 }),
    post('post_release', 'published',
      { title: 'Spring release notes', excerpt: 'Everything that shipped this quarter.', content: '<p>Lots of #release news here. #howto</p>' },
      { title: 'ملاحظات إصدار الربيع', excerpt: 'كل ما تم إطلاقه هذا الربع.', content: '<p>الكثير من أخبار #release هنا.</p>' },
      { publishDate: day(-3), views: 218, commentsCount: 3,
        mainTaxonomyId: 'tax_tech', taxonomyIds: ['tax_tech', 'tax_feature'], authorEmployeeId: 'emp_dev' }),
    post('post_howto', 'published',
      { title: 'How to set up your store', excerpt: 'A step-by-step walkthrough.', content: '<p>#howto step one ...</p>' },
      { title: 'كيف تنشئ متجرك', excerpt: 'دليل خطوة بخطوة.', content: '<p>الخطوة الأولى ...</p>' },
      { publishDate: day(-10), views: 1024, commentsCount: 2,
        mainTaxonomyId: 'tax_tutorials', taxonomyIds: ['tax_tutorials', 'tax_guide', 'tax_tips'], authorEmployeeId: 'emp_mkt' }),
    post('post_tips', 'published',
      { title: '5 tips to grow your audience', excerpt: 'Small changes, big results.', content: '<p>#tips #howto ...</p>' },
      { title: '٥ نصائح لتنمية جمهورك', excerpt: 'تغييرات صغيرة بأثر كبير.', content: '<p>...</p>' },
      { publishDate: day(-15), views: 96, commentsCount: 1,
        mainTaxonomyId: 'tax_news', taxonomyIds: ['tax_news', 'tax_tips'] }),
    post('post_draft', 'draft',
      { title: 'A work in progress', excerpt: 'Still figuring this one out.', content: '<p>TODO</p>' },
      { title: 'قيد العمل', excerpt: 'لا يزال قيد التطوير.', content: '<p>TODO</p>' },
      { taxonomyIds: ['tax_tech'], authorEmployeeId: 'emp_dev' }),
    post('post_scheduled', 'scheduled',
      { title: 'Coming soon: our next big thing', excerpt: 'You will want to read this.', content: '<p>Big news soon. #launch</p>' },
      { title: 'قريباً: شيء كبير قادم', excerpt: 'ستحب قراءة هذا.', content: '<p>أخبار كبيرة قريباً.</p>' },
      { scheduledDate: day(7), mainTaxonomyId: 'tax_news', taxonomyIds: ['tax_news', 'tax_announcement'] }),
  ];
}

function seedComments(): BlogComment[] {
  const day = (offset: number) => new Date(Date.now() + offset * 86400000).toISOString();
  const c = (
    id: string, postId: string, postTitle: string, name: string, kind: 'shopper' | 'employee',
    content: string, status: CommentStatus, extras: Partial<BlogComment> = {},
  ): BlogComment => ({
    id, postId, postTitle,
    shopperId:        kind === 'shopper'  ? `shp_${name.toLowerCase().replace(/\s+/g, '_')}` : null,
    authorEmployeeId: kind === 'employee' ? 'emp_admin' : null,
    authorName: name, authorAvatar: null, authorKind: kind,
    content, parentCommentId: null,
    status, language: 'en',
    createdAt: day(-2), updatedAt: day(-2),
    ...extras,
  });
  const root1 = c('cmt_1', 'post_welcome', 'Welcome to our blog', 'Ahmed Ali',   'shopper',  'Looks great! Excited for more.',           'visible');
  const root2 = c('cmt_2', 'post_welcome', 'Welcome to our blog', 'Layla Khan',  'shopper',  'When will Arabic content come?',           'pending');
  const root3 = c('cmt_3', 'post_release', 'Spring release notes', 'Yusuf Saad', 'shopper',  'Is the new search live for everyone?',     'visible');
  const root4 = c('cmt_4', 'post_release', 'Spring release notes', 'Mai Nasser', 'shopper',  'Spam pls click here!!!',                   'flagged');
  const root5 = c('cmt_5', 'post_howto',   'How to set up your store', 'Ahmed Ali', 'shopper', 'Step 3 was confusing — clearer screenshots?', 'visible');
  const root6 = c('cmt_6', 'post_howto',   'How to set up your store', 'Layla Khan', 'shopper', 'This helped a lot, thanks!',           'visible');
  const root7 = c('cmt_7', 'post_tips',    '5 tips to grow your audience', 'Yusuf Saad', 'shopper', 'Tip #4 was gold.',                 'visible');
  const root8 = c('cmt_8', 'post_welcome', 'Welcome to our blog', 'Old User',    'shopper',  'Removed for policy reasons.',              'deleted');
  return [
    root1,
    root2,
    root3,
    root4,
    root5,
    root6,
    root7,
    root8,
    // Employee replies
    c('cmt_9',  'post_welcome', 'Welcome to our blog', 'Sarah Admin', 'employee',
      'Thanks for the support — Arabic posts coming next week!', 'visible',
      { parentCommentId: 'cmt_1', parentExcerpt: 'Looks great! Excited for more.', parentAuthor: 'Ahmed Ali' }),
    c('cmt_10', 'post_release', 'Spring release notes', 'Omar Devlin', 'employee',
      'Yes — rolling out to all stores this week.', 'visible',
      { parentCommentId: 'cmt_3', parentExcerpt: 'Is the new search live for everyone?', parentAuthor: 'Yusuf Saad' }),
    // Shopper replies
    c('cmt_11', 'post_howto', 'How to set up your store', 'Mai Nasser', 'shopper',
      '+1 — same here, the third step is unclear.', 'visible',
      { parentCommentId: 'cmt_5', parentExcerpt: 'Step 3 was confusing — clearer screenshots?', parentAuthor: 'Ahmed Ali' }),
    c('cmt_12', 'post_welcome', 'Welcome to our blog', 'Ahmed Ali', 'shopper',
      'Awesome, will check back.', 'visible',
      { parentCommentId: 'cmt_9', parentExcerpt: 'Thanks for the support — Arabic posts coming next week!', parentAuthor: 'Sarah Admin' }),
  ];
}

function seedSettings(): BlogSettingsRow {
  return {
    id:        'bs_seed',
    companyId: 'co_seed',
    type:      'BlogSettings',
    template:  defaultBlogSettings(),
  };
}

function slugify(s: string): string {
  return s.toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]+/gu, '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 80);
}
