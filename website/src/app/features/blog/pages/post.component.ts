import { Component, ChangeDetectionStrategy, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { combineLatest } from 'rxjs';
import { map, distinctUntilChanged } from 'rxjs/operators';

import { PublicBlogApiService } from '../services/public-blog-api.service';
import { BlogSettingsService } from '../services/blog-settings.service';
import { BlogSeoService } from '../services/blog-seo.service';
import { BlogPost } from '../models/blog.types';

import { BlogHeaderComponent } from '../components/blog-header.component';
import { BreadcrumbsComponent, Crumb } from '../components/breadcrumbs.component';
import { LanguageSwitcherComponent } from '../components/language-switcher.component';
import { PostContentComponent } from '../components/post-content.component';
import { RelatedPostsComponent } from '../components/related-posts.component';
import { AuthorCardComponent } from '../components/author-card.component';
import { ShareButtonsComponent } from '../components/share-buttons.component';
import { CommentSectionComponent } from '../components/comments/comment-section.component';
import { ErrorBannerComponent } from '../components/ui-bits.component';

import { environment } from '../../../../environments/environment';
import { formatDate, formatNumber, nativeLanguageName, t } from '../i18n/i18n';

/**
 * Single post page. Loads everything from `getPublicPost` in one
 * request (the backend bakes in related posts and SEO block). If the
 * backend returns wasFallback=true the API has already done its 301
 * server-side per the contract, so we treat anything that lands here
 * as canonical.
 *
 * 404 path: surface the error banner with a back-to-blog link rather
 * than redirecting away — preserves URL for the user and matches
 * what crawlers expect when they hit a removed slug.
 */
@Component({
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule, RouterLink,
    BlogHeaderComponent, BreadcrumbsComponent, LanguageSwitcherComponent,
    PostContentComponent, RelatedPostsComponent, AuthorCardComponent,
    ShareButtonsComponent, CommentSectionComponent, ErrorBannerComponent,
  ],
  template: `
    @if (settingsLoaded()) {
      <app-blog-header
        [lang]="lang()"
        [siteName]="siteName()"
        [languages]="supportedLangs()">
      </app-blog-header>

      <div class="container">
        @if (loading()) {
          <p class="loading">…</p>
        } @else if (notFound()) {
          <div class="not-found">
            <h1>{{ t(lang(), '404_title') }}</h1>
            <p>{{ t(lang(), '404_body') }}</p>
            <a class="btn" [routerLink]="blogLink()">{{ t(lang(), 'back_to_blog') }}</a>
          </div>
        } @else if (error()) {
          <app-error-banner [lang]="lang()" [showRetry]="true" (retry)="load()"></app-error-banner>
        } @else {
          @if (post(); as p) {
          <div class="post-top">
            <app-breadcrumbs [crumbs]="crumbs()"></app-breadcrumbs>
            @if (p.availableLanguages.length > 1) {
              <app-language-switcher
                [languages]="p.availableLanguages"
                [current]="lang()"
                [urlFor]="urlForLang">
              </app-language-switcher>
            }
          </div>

          @if (p.wasFallback) {
            <div class="fallback-notice" role="status">
              {{ fallbackNotice(p) }}
            </div>
          }

          <header class="head">
            @if (display().showCategoryLabel && p.mainCategory; as cat) {
              <a class="cat" [routerLink]="blogLink('category', cat.slug)">{{ cat.name }}</a>
            }
            <h1>{{ p.title }}</h1>
            <div class="meta">
              @if (display().showAuthor && p.author) {
                <span class="author">
                  @if (p.author.image) { <img [src]="p.author.image" alt="" class="avatar"> }
                  @if (p.author.id) {
                    <a [routerLink]="blogLink('authors', p.author.id)">{{ p.author.name }}</a>
                  } @else { <span>{{ p.author.name }}</span> }
                  @if (p.author.publicTitle) { <span class="title">· {{ p.author.publicTitle }}</span> }
                </span>
              }
              @if (display().showDate) {
                <time class="date" [attr.datetime]="p.publishDate">{{ formatDate(lang(), p.publishDate) }}</time>
              }
              @if (display().showReadingTime && p.readingTime > 0) {
                <span class="reading">{{ p.readingTime }} {{ t(lang(), 'min_read') }}</span>
              }
              @if (display().showCommentCount && p.commentsCount > 0) {
                <span class="comments-count">💬 {{ formatNumber(lang(), p.commentsCount) }}</span>
              }
              <span class="views">👁 {{ formatNumber(lang(), p.views) }}</span>
            </div>
            @if (display().showTags && p.tags.length) {
              <div class="tags">
                @for (tagRef of p.tags; track tagRef.id) {
                  <a class="chip" [routerLink]="blogLink('tag', tagRef.slug)">{{ tagRef.name }}</a>
                }
              </div>
            }
          </header>

          @if (p.coverImage) {
            <figure class="cover">
              <img [src]="p.coverImage"
                   [alt]="'Cover image for ' + p.title"
                   fetchpriority="high"
                   loading="eager">
            </figure>
          } @else {
            <div class="cover-fallback"></div>
          }

          <app-post-content [html]="p.content" [lang]="lang()"></app-post-content>

          @if (display().showSocialShare) {
            <div class="share-row">
              <app-share-buttons
                [url]="canonicalUrl()"
                [title]="p.title"
                [lang]="lang()">
              </app-share-buttons>
            </div>
          }

          <app-author-card [author]="p.author" [lang]="lang()"></app-author-card>

          @if (display().showRelatedPosts) {
            <app-related-posts
              [posts]="p.relatedPosts"
              [lang]="lang()"
              [display]="display()">
            </app-related-posts>
          }

          <app-comment-section
            [postId]="p.id"
            [lang]="lang()"
            [settings]="commentsSettings()">
          </app-comment-section>
          }
        }
      </div>
    }
  `,
  styles: [`
    :host {
      display: block; min-height: 100vh;
      background: var(--body-bg, #fff); color: var(--body-text, #1a1a1a);
      --read: 760px;
      --hair: color-mix(in srgb, var(--body-text, #1a1a1a) 12%, transparent);
      --muted: color-mix(in srgb, var(--body-text, #1a1a1a) 60%, transparent);
    }
    .container { max-width: 1100px; margin: 0 auto; padding: 24px; }
    .loading { text-align: center; padding: 80px 0; opacity: .6; }
    .not-found { text-align: center; padding: 80px 24px; }
    .not-found h1 { margin: 0 0 8px; font-size: 28px; }
    .not-found .btn {
      display: inline-block; margin-top: 16px;
      padding: 10px 20px; border-radius: 8px;
      background: var(--primary, #6366f1); color: #fff; text-decoration: none;
    }

    .post-top {
      max-width: var(--read); margin: 0 auto;
      display: flex; gap: 16px; align-items: center;
      flex-wrap: wrap; justify-content: space-between;
      padding: 8px 0 4px;
    }

    /* Title block sits ABOVE the cover (magazine style). */
    .head { max-width: var(--read); margin: 8px auto 28px; }
    .cat {
      display: inline-block;
      font-size: 12.5px; font-weight: 700;
      text-transform: uppercase; letter-spacing: .08em;
      color: var(--primary, #6366f1); text-decoration: none;
      margin-bottom: 16px;
    }
    h1 {
      margin: 0 0 20px;
      font-family: 'Playfair Display', Georgia, serif;
      font-size: 46px; line-height: 1.12; font-weight: 800; letter-spacing: -.015em;
    }
    .meta {
      display: flex; flex-wrap: wrap; gap: 10px 14px;
      font-size: 14px; color: var(--muted);
      align-items: center;
    }
    /* Dot separators between meta items. */
    .meta > * + *::before { content: '·'; margin-inline-end: 14px; color: var(--hair); }
    .author { display: inline-flex; align-items: center; gap: 9px; }
    .author a { color: var(--body-text, #1a1a1a); font-weight: 600; text-decoration: none; }
    .author a:hover { text-decoration: underline; }
    .author .title { opacity: .7; font-weight: 400; }
    .avatar { width: 34px; height: 34px; border-radius: 50%; object-fit: cover; }
    .tags { display: flex; flex-wrap: wrap; gap: 7px; margin-top: 18px; }
    .chip {
      font-size: 12px; padding: 5px 12px; border-radius: 100px;
      border: 1px solid var(--hair); color: var(--muted); text-decoration: none;
      transition: border-color .15s ease, color .15s ease;
    }
    .chip:hover { border-color: var(--primary, #6366f1); color: var(--primary, #6366f1); }

    .cover { margin: 0 auto 44px; max-width: 960px; }
    .cover img {
      width: 100%; max-height: 64vh; object-fit: cover;
      border-radius: 16px; display: block;
    }
    .cover-fallback {
      height: 200px; border-radius: 16px; max-width: 960px; margin: 0 auto 44px;
      background: linear-gradient(135deg, var(--primary, #6366f1), #8b5cf6);
    }

    .share-row { max-width: var(--read); margin: 44px auto; padding: 20px 0; border-block: 1px solid var(--hair); }

    .fallback-notice {
      max-width: var(--read); margin: 0 auto 24px;
      padding: 10px 16px;
      background: rgba(255, 200, 0, .12);
      border-inline-start: 4px solid #f5a623;
      border-radius: 6px;
      font-size: 14px;
      color: #6b4f00;
    }

    @media (max-width: 768px) {
      h1 { font-size: 32px; }
      .cover img { border-radius: 12px; }
    }
  `],
})
export class PostPage implements OnInit {
  private api = inject(PublicBlogApiService);
  private settingsSvc = inject(BlogSettingsService);
  private seo = inject(BlogSeoService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  lang = signal('en');
  slug = signal('');
  post = signal<BlogPost | null>(null);
  loading = signal(true);
  error = signal<string | null>(null);
  notFound = signal(false);
  settingsLoaded = signal(false);

  display          = computed(() => this.settingsSvc.settings().display);
  commentsSettings = computed(() => this.settingsSvc.settings().comments);
  supportedLangs   = computed(() => this.settingsSvc.settings().languages.supported);
  siteName         = computed(() => this.settingsSvc.settings().siteName ?? environment.siteName);

  t = t;
  formatDate = formatDate;
  formatNumber = formatNumber;

  /** Blog router commands, lang-less for the default language. */
  blogLink = (...segments: (string | number)[]) => this.settingsSvc.blogLink(this.lang(), ...segments);

  urlForLang = (lang: string): string | null => {
    const alts = this.post()?.seo?.hreflangAlternates;
    const found = alts?.find(a => a.lang === lang);
    if (found) {
      try { return new URL(found.url).pathname; } catch { return found.url; }
    }
    return this.settingsSvc.blogLink(lang).join('/').replace('//', '/');
  };

  canonicalUrl(): string {
    const p = this.post();
    return p?.seo?.canonical || this.settingsSvc.blogUrl(this.lang(), this.slug());
  }

  crumbs = computed<Crumb[]>(() => {
    const p = this.post();
    const lang = this.lang();
    const main = p?.mainCategory;
    const list: Crumb[] = [
      { label: this.t(lang, 'home'), link: ['/', lang] },
      { label: this.t(lang, 'blog'), link: this.blogLink() },
    ];
    if (main) list.push({ label: main.name, link: this.blogLink('category', main.slug) });
    if (p) list.push({ label: p.title, link: null });
    return list;
  });

  fallbackNotice(p: BlogPost): string {
    const shown = nativeLanguageName(p.contentLanguage);
    return t(this.lang(), 'fallback_notice', { lang: shown });
  }

  async ngOnInit(): Promise<void> {
    // Language comes from the `:lang` path (subdirectory mode) OR the `?lang=`
    // query (parameter mode); re-bootstrap only when lang or slug changes.
    combineLatest([this.route.paramMap, this.route.queryParamMap]).pipe(
      map(([p, q]) => ({ lang: p.get('lang') || q.get('lang') || 'en', slug: p.get('slug') ?? '' })),
      distinctUntilChanged((a, b) => a.lang === b.lang && a.slug === b.slug),
    ).subscribe(({ lang, slug }) => {
      this.lang.set(lang);
      this.slug.set(slug);
      this.bootstrap();
    });
  }

  private async bootstrap(): Promise<void> {
    try {
      const s = await this.settingsSvc.load();
      this.settingsLoaded.set(true);
      this.seo.setLangAndDir(this.lang(), s.languages.rtlLanguages.includes(this.lang()));
      await this.load();
    } catch (e: any) {
      this.error.set(e?.message ?? 'Failed to load settings');
      this.settingsLoaded.set(true);
      this.loading.set(false);
    }
  }

  async load(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    this.notFound.set(false);
    try {
      // `?preview=1` (set by the dashboard's Preview action) asks the
      // backend to return the post even when it isn't published yet.
      const preview = this.route.snapshot.queryParamMap.get('preview') === '1';
      const p = await this.api.getPublicPost(this.slug(), this.lang(), preview);
      if (!p) { this.notFound.set(true); return; }
      this.post.set(p);
      const fullUrl = this.canonicalUrl();
      const rss = this.api.rssUrl(this.lang());
      this.seo.applyForPost(p, this.lang(), fullUrl, rss);
    } catch (e: any) {
      if (e?.status === 404) this.notFound.set(true);
      else this.error.set(e?.message ?? 'Failed to load post');
    } finally {
      this.loading.set(false);
    }
  }
}
