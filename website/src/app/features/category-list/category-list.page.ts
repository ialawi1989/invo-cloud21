import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';

import { ResolvedPage } from '../../core/page-types/page-type.types';
import { SiteConfigService } from '../../core/site-config/site-config.service';
import { CategoryApiService, CategoryGroup } from './category.api';

/**
 * Categories — the `category-list` page type.
 *
 * Tiles link to the store's PRIMARY LISTING with a category filter, which is
 * where `commerce.primaryListingSlug` finally does its job: the old storefront
 * hardcoded `/shop` here, so a restaurant whose listing was `/menu` sent every
 * category click to a page it didn't have. The setting exists precisely because
 * one store's "browse products" page is not another's.
 */
@Component({
  selector: 'app-category-list-page',
  standalone: true,
  imports: [CommonModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="cl">
      <header class="cl__head">
        <h1 class="cl__title">{{ page().name || 'Categories' }}</h1>
      </header>

      @if (loading()) {
        <div class="cl__state"><span class="cl__spin"></span></div>
      } @else if (!groups().length) {
        <div class="cl__state cl__muted">Nothing to browse yet.</div>
      } @else {
        @for (group of groups(); track group.id) {
          <section class="cl__group">
            @if (group.name) { <h2 class="cl__group-title">{{ group.name }}</h2> }

            <div class="cl__tiles">
              @for (cat of group.categories; track cat.id) {
                <a class="cl__tile"
                   [routerLink]="listingLink()"
                   [queryParams]="{ categoryId: cat.id, departmentId: group.id }">
                  <div class="cl__thumb"
                       [style.background-image]="thumb(cat.mediaUrl)"
                       [style.background-size]="imageFit()"></div>
                  <span class="cl__name">{{ cat.name }}</span>
                </a>
              }
            </div>
          </section>
        }
      }
    </section>
  `,
  styles: [`
    .cl { max-width: 1180px; margin: 0 auto; padding: 28px 20px 56px; }
    .cl__head { margin-bottom: 20px; }
    .cl__title { margin: 0; font-size: 26px; font-weight: 700; color: #111827; }

    .cl__group + .cl__group { margin-top: 32px; }
    .cl__group-title { margin: 0 0 14px; font-size: 17px; font-weight: 600; color: #374151; }

    .cl__tiles { display: grid; grid-template-columns: repeat(auto-fill, minmax(170px, 1fr)); gap: 16px; }
    .cl__tile {
      display: flex; flex-direction: column; gap: 8px; text-decoration: none; color: inherit;
      border: 1px solid #eceff3; border-radius: 12px; overflow: hidden; background: #fff;
      transition: border-color .15s, transform .15s;
    }
    .cl__tile:hover { border-color: #d6dbe3; transform: translateY(-2px); }
    .cl__thumb { width: 100%; padding-top: 72%; background: #f3f4f6 center/cover no-repeat; }
    .cl__name { padding: 0 12px 12px; font-size: 14px; font-weight: 500; }

    .cl__state { padding: 60px 0; text-align: center; }
    .cl__muted { color: #6b7280; font-size: 14px; }
    .cl__spin {
      display: inline-block; width: 26px; height: 26px; border-radius: 50%;
      border: 3px solid #e5e7eb; border-top-color: #6d3bf5; animation: clspin .8s linear infinite;
    }
    @keyframes clspin { to { transform: rotate(360deg); } }
    @media (prefers-reduced-motion: reduce) { .cl__spin { animation: none; } }
  `],
})
export class CategoryListPage {
  private api        = inject(CategoryApiService);
  private siteConfig = inject(SiteConfigService);
  private router     = inject(Router);

  page = input.required<ResolvedPage>();

  loading = signal<boolean>(true);
  groups  = signal<CategoryGroup[]>([]);

  /** Tile image fit, from the page's settings (site default applied upstream). */
  imageFit = computed<string>(() => String(this.page().settings['product_image_size'] || 'cover'));

  private loadedFor = '';

  constructor() {
    queueMicrotask(() => void this.sync());
  }

  ngOnChanges(): void { void this.sync(); }

  private async sync(): Promise<void> {
    const page = this.page();
    if (!page || this.loadedFor === page.slug) return;
    this.loadedFor = page.slug;

    this.loading.set(true);
    try {
      this.groups.set(await this.api.load());
    } finally {
      this.loading.set(false);
    }
  }

  /**
   * Where a category tile goes: the store's primary listing, else the first
   * listing we know of, else `/shop` as a last resort. Never a hardcoded page
   * the store might not have.
   */
  listingLink = computed<any[]>(() => {
    const slug = String(this.siteConfig.value('commerce', 'primaryListingSlug', '') || 'shop');
    const first = this.router.url.split('?')[0].split('/').filter(Boolean)[0] ?? '';
    const isLang = !!first && first.length <= 5;
    return isLang ? ['/', first, slug] : ['/', slug];
  });

  thumb(url?: string): string {
    return url ? `url("${url}")` : 'none';
  }
}
