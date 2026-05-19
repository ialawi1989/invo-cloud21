import { Component, ChangeDetectionStrategy, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

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
            <a class="btn" [routerLink]="['/', lang(), 'blog']">{{ t(lang(), 'back_to_blog') }}</a>
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

          <header class="head">
            @if (p.mainCategory; as cat) {
              <a class="cat" [routerLink]="['/', lang(), 'blog', 'category', cat.slug]">{{ cat.name }}</a>
            }
            <h1>{{ p.title }}</h1>
            <div class="meta">
              @if (p.author) {
                <span class="author">
                  @if (p.author.image) { <img [src]="p.author.image" alt="" class="avatar"> }
                  @if (p.author.id) {
                    <a [routerLink]="['/', lang(), 'blog', 'authors', p.author.id]">{{ p.author.name }}</a>
                  } @else { <span>{{ p.author.name }}</span> }
                  @if (p.author.publicTitle) { <span class="title">· {{ p.author.publicTitle }}</span> }
                </span>
              }
              <time class="date" [attr.datetime]="p.publishDate">{{ formatDate(lang(), p.publishDate) }}</time>
              @if (p.readingTime > 0) {
                <span class="reading">{{ p.readingTime }} {{ t(lang(), 'min_read') }}</span>
              }
              <span class="views" aria-hidden="true">👁 {{ formatNumber(lang(), p.views) }}</span>
            </div>
            @if (p.tags.length) {
              <div class="tags">
                @for (tagRef of p.tags; track tagRef.id) {
                  <a class="chip" [routerLink]="['/', lang(), 'blog', 'tag', tagRef.slug]">{{ tagRef.name }}</a>
                }
              </div>
            }
          </header>

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
    :host { display: block; min-height: 100vh; background: var(--body-bg, #fff); color: var(--body-text, #111); }
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
      display: flex; gap: 16px; align-items: center;
      flex-wrap: wrap; justify-content: space-between;
      padding: 16px 0;
    }

    .cover { margin: 0 0 32px; }
    .cover img {
      width: 100%; max-height: 60vh; object-fit: cover;
      border-radius: 12px; display: block;
    }
    .cover-fallback {
      height: 220px; border-radius: 12px;
      background: linear-gradient(135deg, var(--primary, #6366f1), #8b5cf6);
      margin-bottom: 32px;
    }

    .head { max-width: 820px; margin: 0 auto 32px; }
    .cat {
      display: inline-block;
      font-size: 13px; font-weight: 600;
      text-transform: uppercase; letter-spacing: .04em;
      color: var(--primary, #6366f1); text-decoration: none;
      margin-bottom: 12px;
    }
    h1 { margin: 0 0 16px; font-size: 40px; line-height: 1.2; }
    .meta {
      display: flex; flex-wrap: wrap; gap: 16px;
      font-size: 14px; color: rgba(0,0,0,.65);
      align-items: center;
    }
    .author { display: inline-flex; align-items: center; gap: 8px; }
    .author a { color: inherit; text-decoration: none; }
    .author a:hover { text-decoration: underline; }
    .author .title { opacity: .7; }
    .avatar { width: 28px; height: 28px; border-radius: 50%; object-fit: cover; }
    .tags { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 12px; }
    .chip { font-size: 12px; padding: 4px 10px; border-radius: 100px; background: rgba(0,0,0,.05); color: inherit; text-decoration: none; }

    .share-row { max-width: 720px; margin: 32px auto; padding: 20px 0; border-block: 1px solid rgba(0,0,0,.08); }

    .fallback-notice {
      max-width: 820px; margin: 0 auto 24px;
      padding: 10px 16px;
      background: rgba(255, 200, 0, .12);
      border-inline-start: 4px solid #f5a623;
      border-radius: 6px;
      font-size: 14px;
      color: #6b4f00;
    }

    @media (max-width: 768px) {
      h1 { font-size: 28px; }
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

  urlForLang = (lang: string): string | null => {
    const alts = this.post()?.seo?.hreflangAlternates;
    const found = alts?.find(a => a.lang === lang);
    if (found) {
      try { return new URL(found.url).pathname; } catch { return found.url; }
    }
    return `/${lang}/blog`;
  };

  canonicalUrl(): string {
    const origin = environment.siteOrigin || '';
    const p = this.post();
    return p?.seo?.canonical || `${origin}/${this.lang()}/blog/${this.slug()}`;
  }

  crumbs = computed<Crumb[]>(() => {
    const p = this.post();
    const lang = this.lang();
    const main = p?.mainCategory;
    const list: Crumb[] = [
      { label: this.t(lang, 'home'), link: ['/', lang] },
      { label: this.t(lang, 'blog'), link: ['/', lang, 'blog'] },
    ];
    if (main) list.push({ label: main.name, link: ['/', lang, 'blog', 'category', main.slug] });
    if (p) list.push({ label: p.title, link: null });
    return list;
  });

  fallbackNotice(p: BlogPost): string {
    const shown = nativeLanguageName(p.contentLanguage);
    return t(this.lang(), 'fallback_notice', { lang: shown });
  }

  async ngOnInit(): Promise<void> {
    this.route.paramMap.subscribe(p => {
      this.lang.set(p.get('lang') ?? 'en');
      this.slug.set(p.get('slug') ?? '');
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
      const p = await this.api.getPublicPost(this.slug(), this.lang());
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
