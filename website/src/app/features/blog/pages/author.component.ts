import { Component, ChangeDetectionStrategy, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';

import { PublicBlogApiService } from '../services/public-blog-api.service';
import { BlogSettingsService } from '../services/blog-settings.service';
import { BlogSeoService } from '../services/blog-seo.service';
import { AuthorProfileResult } from '../models/blog.types';

import { BlogHeaderComponent } from '../components/blog-header.component';
import { LayoutRendererComponent } from '../components/layouts/layout-renderer.component';
import { PaginationComponent } from '../components/pagination.component';
import { LoadingSkeletonComponent, ErrorBannerComponent } from '../components/ui-bits.component';

import { environment } from '../../../../environments/environment';
import { t } from '../i18n/i18n';

@Component({
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    BlogHeaderComponent, LayoutRendererComponent, PaginationComponent,
    LoadingSkeletonComponent, ErrorBannerComponent,
  ],
  template: `
    @if (settingsLoaded()) {
      <app-blog-header [lang]="lang()" [siteName]="siteName()" [languages]="supportedLangs()"></app-blog-header>

      @if (loading() && !result()) {
        <div class="container"><app-loading-skeleton [count]="6"></app-loading-skeleton></div>
      } @else if (notFound()) {
        <div class="container"><h1>{{ t(lang(), '404_title') }}</h1></div>
      } @else if (error()) {
        <div class="container"><app-error-banner [lang]="lang()" [showRetry]="true" (retry)="load()"></app-error-banner></div>
      } @else {
        @if (result(); as r) {
          @if (r.profile.coverImage) {
          <div class="cover" [style.background-image]="'url(' + r.profile.coverImage + ')'"></div>
        }
        <header class="profile">
          @if (r.profile.image) {
            <img [src]="r.profile.image" [alt]="r.profile.name" class="avatar">
          }
          <h1>{{ r.profile.name }}</h1>
          @if (r.profile.title) { <div class="title">{{ r.profile.title }}</div> }
          @if (r.profile.bio) { <p class="bio">{{ r.profile.bio }}</p> }
          @if (r.profile.socialLinks.length) {
            <ul class="socials">
              @for (l of r.profile.socialLinks; track l.url) {
                <li><a [href]="l.url" target="_blank" rel="noopener">{{ l.kind }}</a></li>
              }
            </ul>
          }
        </header>

        <div class="container">
          <app-layout-renderer
            [posts]="r.posts.data"
            [layout]="categoryLayout()"
            [lang]="lang()"
            [display]="display()"
            [mobile]="mobile()">
          </app-layout-renderer>

          <app-pagination
            [page]="page()"
            [pageCount]="r.posts.pagination.totalPages"
            [lang]="lang()"
            (pageChange)="goToPage($event)">
          </app-pagination>
        </div>
        }
      }
    }
  `,
  styles: [`
    :host { display: block; min-height: 100vh; background: var(--body-bg, #fff); color: var(--body-text, #111); }
    .container { max-width: 1200px; margin: 0 auto; padding: 24px; }
    .cover { height: 240px; background-size: cover; background-position: center; }
    .profile {
      text-align: center; padding: 0 24px 24px;
      max-width: 720px; margin: 0 auto;
    }
    .avatar {
      width: 128px; height: 128px; border-radius: 50%;
      object-fit: cover;
      margin-top: -64px; border: 6px solid var(--body-bg, #fff);
      box-shadow: 0 4px 12px rgba(0,0,0,.1);
    }
    .profile h1 { margin: 16px 0 4px; font-size: 28px; }
    .title { opacity: .7; font-size: 14px; }
    .bio { margin: 16px 0; line-height: 1.6; }
    .socials { list-style: none; padding: 0; display: flex; justify-content: center; gap: 14px; }
    .socials a { color: var(--primary, #6366f1); text-decoration: none; text-transform: capitalize; }
    .socials a:hover { text-decoration: underline; }
  `],
})
export class AuthorPage implements OnInit {
  private api = inject(PublicBlogApiService);
  private settingsSvc = inject(BlogSettingsService);
  private seo = inject(BlogSeoService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  lang = signal('en');
  /** Author profile is keyed by employeeId on the new contract; the
   *  route param name reflects that. We keep the field name `slug`
   *  off the type only to avoid a wider rename — the value is an
   *  employeeId. */
  authorEmployeeId = signal('');
  page = signal(1);
  result = signal<AuthorProfileResult | null>(null);
  loading = signal(true);
  error = signal<string | null>(null);
  notFound = signal(false);
  settingsLoaded = signal(false);

  display = computed(() => this.settingsSvc.settings().display);
  mobile  = computed(() => this.settingsSvc.settings().mobile);
  categoryLayout = computed(() => this.settingsSvc.settings().layouts.categoryFeed);
  supportedLangs = computed(() => this.settingsSvc.settings().languages.supported);
  siteName       = computed(() => this.settingsSvc.settings().siteName ?? environment.siteName);

  t = t;

  async ngOnInit(): Promise<void> {
    this.route.paramMap.subscribe(p => {
      this.lang.set(p.get('lang') ?? 'en');
      this.authorEmployeeId.set(p.get('authorEmployeeId') ?? '');
      this.bootstrap();
    });
    this.route.queryParamMap.subscribe(q => {
      const p = Number(q.get('page') ?? '1') || 1;
      if (p !== this.page()) { this.page.set(p); this.load(); }
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
      const r = await this.api.getAuthorProfile(this.authorEmployeeId(), this.lang());
      this.result.set(r);
      this.applySeo(r);
    } catch (e: any) {
      if (e?.status === 404) this.notFound.set(true);
      else this.error.set(e?.message ?? 'Failed to load author');
    } finally {
      this.loading.set(false);
    }
  }

  goToPage(p: number): void {
    this.router.navigate([], { queryParams: { page: p > 1 ? p : null }, queryParamsHandling: 'merge' });
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  private applySeo(r: AuthorProfileResult): void {
    const origin = environment.siteOrigin || '';
    const lang = this.lang();
    const url = `${origin}/${lang}/blog/authors/${this.authorEmployeeId()}`;
    this.seo.apply({
      title: `${r.profile.name} | ${this.siteName()}`,
      description: (r.profile.bio || '').slice(0, 160) || r.profile.title || r.profile.name,
      url,
      image: r.profile.image,
      type: 'profile',
      locale: lang,
      hreflang: this.supportedLangs().map(l => ({ lang: l, url: `${origin}/${l}/blog/authors/${this.authorEmployeeId()}` })),
      siteName: this.siteName(),
    });
    this.seo.setJsonLd([{
      '@context': 'https://schema.org',
      '@type':    'Person',
      'name':     r.profile.name,
      'jobTitle': r.profile.title || undefined,
      'image':    r.profile.image || undefined,
      'description': r.profile.bio || undefined,
      'url':      url,
      'sameAs':   r.profile.socialLinks?.map(l => l.url),
    }]);
  }
}
