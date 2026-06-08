import { Component, ChangeDetectionStrategy, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';

import { PublicBlogApiService } from '../services/public-blog-api.service';
import { BlogSettingsService } from '../services/blog-settings.service';
import { BlogSeoService } from '../services/blog-seo.service';
import { PostListResult } from '../models/blog.types';

import { BlogHeaderComponent } from '../components/blog-header.component';
import { LayoutRendererComponent } from '../components/layouts/layout-renderer.component';
import { PaginationComponent } from '../components/pagination.component';
import { LoadingSkeletonComponent, ErrorBannerComponent, EmptyStateComponent } from '../components/ui-bits.component';

import { environment } from '../../../../environments/environment';
import { t } from '../i18n/i18n';

@Component({
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule, FormsModule,
    BlogHeaderComponent, LayoutRendererComponent, PaginationComponent,
    LoadingSkeletonComponent, ErrorBannerComponent, EmptyStateComponent,
  ],
  template: `
    @if (settingsLoaded()) {
      <app-blog-header [lang]="lang()" [siteName]="siteName()" [languages]="supportedLangs()"></app-blog-header>

      <div class="container">
        <form class="searchbar" (ngSubmit)="submit()">
          <input type="search" [(ngModel)]="draft" name="q" [placeholder]="t(lang(), 'search_placeholder')">
          <button type="submit" class="btn primary">{{ t(lang(), 'search') }}</button>
        </form>

        @if (query()) {
          <h1 class="results-h">{{ t(lang(), 'showing_results', { n: total(), q: query() }) }}</h1>
        }

        @if (loading() && !result()) {
          <app-loading-skeleton [count]="display().postsPerPage"></app-loading-skeleton>
        } @else if (error()) {
          <app-error-banner [lang]="lang()" [showRetry]="true" (retry)="load()"></app-error-banner>
        } @else {
          @if (result(); as r) {
          @if (r.data.length === 0) {
            <app-empty-state [title]="t(lang(), 'no_results')" [body]="t(lang(), 'no_results_hint')"></app-empty-state>
          } @else {
            <app-layout-renderer
              [posts]="r.data"
              [layout]="feedLayout()"
              [lang]="lang()"
              [display]="display()"
              [mobile]="mobile()">
            </app-layout-renderer>

            <app-pagination
              [page]="page()"
              [pageCount]="r.pagination.totalPages"
              [lang]="lang()"
              (pageChange)="goToPage($event)">
            </app-pagination>
          }
          }
        }
      </div>
    }
  `,
  styles: [`
    :host { display: block; min-height: 100vh; background: var(--body-bg, #fff); color: var(--body-text, #111); }
    .container { max-width: 1200px; margin: 0 auto; padding: 24px; }
    .searchbar { display: flex; gap: 8px; margin: 24px 0; }
    .searchbar input {
      flex: 1; padding: 14px 18px;
      font-size: 16px; font: inherit; color: inherit;
      border: 1px solid rgba(0,0,0,.12);
      border-radius: 100px;
      background: rgba(0,0,0,.03);
    }
    .searchbar input:focus { outline: 2px solid var(--primary, #6366f1); outline-offset: 1px; }
    .btn.primary {
      padding: 0 20px;
      background: var(--primary, #6366f1); color: #fff;
      border: 0; border-radius: 100px; cursor: pointer; font: inherit;
    }
    .results-h { margin: 16px 0 24px; font-size: 22px; }
  `],
})
export class SearchPage implements OnInit {
  private api = inject(PublicBlogApiService);
  private settingsSvc = inject(BlogSettingsService);
  private seo = inject(BlogSeoService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  lang = signal('en');
  query = signal('');
  page = signal(1);
  draft = '';
  result = signal<PostListResult | null>(null);
  loading = signal(false);
  error = signal<string | null>(null);
  settingsLoaded = signal(false);

  display = computed(() => this.settingsSvc.settings().display);
  mobile  = computed(() => this.settingsSvc.settings().mobile);
  feedLayout = computed(() => this.settingsSvc.settings().layouts.feed);
  supportedLangs = computed(() => this.settingsSvc.settings().languages.supported);
  siteName       = computed(() => this.settingsSvc.settings().siteName ?? environment.siteName);

  total = computed(() => this.result()?.pagination.total ?? 0);

  t = t;

  async ngOnInit(): Promise<void> {
    this.route.paramMap.subscribe(p => {
      this.lang.set(p.get('lang') ?? 'en');
      this.bootstrap();
    });
    this.route.queryParamMap.subscribe(q => {
      const qStr = q.get('q') ?? '';
      const pn = Number(q.get('page') ?? '1') || 1;
      const changed = qStr !== this.query() || pn !== this.page();
      this.query.set(qStr);
      this.draft = qStr;
      this.page.set(pn);
      if (this.settingsLoaded() && changed) this.load();
    });
  }

  private async bootstrap(): Promise<void> {
    try {
      const s = await this.settingsSvc.load();
      this.settingsLoaded.set(true);
      this.seo.setLangAndDir(this.lang(), s.languages.rtlLanguages.includes(this.lang()));
      this.applySeo();
      if (this.query()) await this.load();
    } catch (e: any) {
      this.error.set(e?.message ?? 'Failed to load settings');
      this.settingsLoaded.set(true);
    }
  }

  async load(): Promise<void> {
    if (!this.query()) { this.result.set(null); return; }
    this.loading.set(true);
    this.error.set(null);
    try {
      const r = await this.api.listPublicPosts({
        language: this.lang(),
        search: this.query(),
        page: this.page(),
        limit: this.display().postsPerPage,
      });
      this.result.set(r);
    } catch (e: any) {
      this.error.set(e?.message ?? 'Search failed');
    } finally {
      this.loading.set(false);
      this.applySeo();
    }
  }

  submit(): void {
    const q = this.draft.trim();
    this.router.navigate(['/', this.lang(), 'blog', 'search'], { queryParams: q ? { q } : {} });
  }

  goToPage(p: number): void {
    this.router.navigate([], { queryParams: { page: p > 1 ? p : null, q: this.query() || null }, queryParamsHandling: 'merge' });
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  private applySeo(): void {
    const origin = this.settingsSvc.originUrl();
    const q = this.query();
    this.seo.apply({
      title: q ? `Search: ${q} | ${this.t(this.lang(), 'blog')}` : `Search | ${this.t(this.lang(), 'blog')}`,
      description: q ? `Search results for "${q}"` : 'Search the blog',
      url: `${origin}/${this.lang()}/blog/search${q ? '?q=' + encodeURIComponent(q) : ''}`,
      noindex: true,
      locale: this.lang(),
      siteName: this.siteName(),
    });
  }
}
