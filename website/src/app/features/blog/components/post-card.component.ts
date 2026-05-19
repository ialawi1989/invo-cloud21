import { Component, Input, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';

import { PostSummary } from '../models/blog.types';
import { PublicBlogDisplaySettings } from '../models/blog-settings.types';
import { formatDate, formatNumber, t } from '../i18n/i18n';

/**
 * Universal post card. Used by every layout. The `variant` switch
 * controls visual emphasis (default/compact/hero/magazine/editorial)
 * but the data shape is identical so layouts stay swappable without
 * any per-card mapping.
 *
 * All display toggles come from BlogSettings.display — pass in the
 * resolved settings rather than reading from a service so we can be
 * pure / OnPush and so layouts can override per-card.
 */
@Component({
  selector: 'app-post-card',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, RouterLink],
  template: `
    <article class="card" [class]="'v-' + variant">
      @if (post.coverImage && variant !== 'editorial-mini') {
        <a class="cover"
           [routerLink]="['/', lang, 'blog', post.slug]"
           [attr.aria-label]="post.title">
          <img
            [src]="post.coverImage"
            [srcset]="srcset(post.coverImage)"
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
            [alt]="'Cover image for ' + post.title"
            [attr.loading]="eagerLoadCover ? 'eager' : 'lazy'"
            decoding="async">
          @if (post.isFeatured) {
            <span class="featured-badge">{{ t('featured') }}</span>
          }
        </a>
      }

      <div class="body">
        @if (display.showCategoryLabel && post.mainCategory) {
          <a class="category"
             [routerLink]="['/', lang, 'blog', 'category', post.mainCategory.slug]">
            {{ post.mainCategory.name }}
          </a>
        }

        <h3 class="title">
          <a [routerLink]="['/', lang, 'blog', post.slug]">{{ post.title }}</a>
        </h3>

        @if (variant !== 'compact' && post.excerpt) {
          <p class="excerpt">{{ post.excerpt }}</p>
        }

        @if (display.showHashtags && post.hashtags.length) {
          <div class="hashtags">
            @for (h of post.hashtags; track h.slug) {
              <a class="chip hash"
                 [routerLink]="['/', lang, 'blog', 'tag', h.slug]">#{{ h.name }}</a>
            }
          </div>
        }

        <div class="meta">
          @if (display.showAuthor && post.author) {
            <span class="author">
              @if (post.author.image) {
                <img [src]="post.author.image" alt="" class="avatar">
              }
              @if (post.author.id) {
                <a [routerLink]="['/', lang, 'blog', 'authors', post.author.id]">{{ post.author.name }}</a>
              } @else {
                <span>{{ post.author.name }}</span>
              }
            </span>
          }
          @if (display.showDate) {
            <span class="date">{{ formatDate(lang, post.publishDate) }}</span>
          }
          @if (display.showReadingTime && post.readingTime > 0) {
            <span class="reading">{{ post.readingTime }} {{ t('min_read') }}</span>
          }
          @if (display.showCommentCount && post.commentsCount > 0) {
            <span class="comments" aria-hidden="true">💬 {{ formatNumber(lang, post.commentsCount) }}</span>
          }
        </div>
      </div>
    </article>
  `,
  styles: [`
    :host { display: block; }
    .card {
      display: flex;
      flex-direction: column;
      background: var(--card-bg, #fff);
      border-radius: 12px;
      overflow: hidden;
      transition: transform .2s ease, box-shadow .2s ease;
      height: 100%;
    }
    .card:hover { transform: translateY(-2px); box-shadow: 0 8px 24px rgba(0,0,0,.08); }
    .cover { position: relative; display: block; overflow: hidden; aspect-ratio: 16 / 9; background: #f3f3f3; }
    .cover img { width: 100%; height: 100%; object-fit: cover; display: block; }
    .featured-badge {
      position: absolute; inset-inline-start: 12px; inset-block-start: 12px;
      background: var(--primary, #6366f1); color: #fff;
      font-size: 11px; padding: 4px 8px; border-radius: 4px; font-weight: 600;
    }
    .body { padding: 16px; display: flex; flex-direction: column; gap: 10px; flex: 1; }
    .category {
      align-self: flex-start;
      font-size: 12px; font-weight: 600; text-transform: uppercase;
      letter-spacing: .04em;
      color: var(--primary, #6366f1);
      text-decoration: none;
    }
    .title { margin: 0; font-size: 18px; line-height: 1.35; }
    .title a { color: inherit; text-decoration: none; }
    .title a:hover { text-decoration: underline; }
    .excerpt {
      margin: 0;
      color: rgba(0,0,0,.65);
      font-size: 14px;
      line-height: 1.55;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }
    .hashtags, .tags { display: flex; flex-wrap: wrap; gap: 6px; }
    .chip {
      font-size: 12px; padding: 3px 8px; border-radius: 100px;
      background: rgba(0,0,0,.05); color: inherit; text-decoration: none;
    }
    .chip.hash { color: var(--primary, #6366f1); background: rgba(99,102,241,.08); }
    .meta {
      margin-top: auto;
      display: flex; flex-wrap: wrap; gap: 12px;
      font-size: 12px; color: rgba(0,0,0,.55);
      align-items: center;
    }
    .author { display: inline-flex; align-items: center; gap: 6px; }
    .author a { color: inherit; text-decoration: none; }
    .avatar { width: 22px; height: 22px; border-radius: 50%; object-fit: cover; }

    /* Variant: hero (magazine top slot) */
    .v-hero { display: grid; grid-template-rows: 60vh; position: relative; border-radius: 16px; }
    .v-hero .cover { aspect-ratio: auto; height: 60vh; }
    .v-hero .body {
      position: absolute; inset-inline-start: 0; inset-inline-end: 0; bottom: 0;
      padding: 40px 32px;
      background: linear-gradient(to top, rgba(0,0,0,.85), transparent);
      color: #fff;
    }
    .v-hero .title { font-size: 36px; line-height: 1.15; }
    .v-hero .excerpt { color: rgba(255,255,255,.85); -webkit-line-clamp: 3; }
    .v-hero .meta { color: rgba(255,255,255,.85); }

    /* Variant: list (horizontal card) */
    .v-list { flex-direction: row; align-items: stretch; }
    .v-list .cover { flex: 0 0 40%; aspect-ratio: auto; min-height: 220px; }
    .v-list .body { flex: 1; padding: 24px 28px; gap: 12px; }
    .v-list .title { font-size: 22px; }
    .v-list .excerpt { -webkit-line-clamp: 3; }

    /* Variant: side-by-side */
    .v-side { flex-direction: row; align-items: stretch; gap: 0; }
    .v-side.reverse { flex-direction: row-reverse; }
    .v-side .cover { flex: 0 0 50%; aspect-ratio: auto; min-height: 260px; }
    .v-side .body { padding: 32px; gap: 14px; }

    /* Variant: editorial */
    .v-editorial { background: transparent; border-radius: 0; border-bottom: 1px solid rgba(0,0,0,.08); padding-bottom: 24px; }
    .v-editorial:hover { transform: none; box-shadow: none; }
    .v-editorial .body { padding: 0; }
    .v-editorial .title {
      font-family: 'Playfair Display', Georgia, serif;
      font-size: 28px;
      line-height: 1.2;
    }
    .v-editorial .excerpt { font-size: 16px; -webkit-line-clamp: 4; }

    /* Variant: editorial-mini (no cover) */
    .v-editorial-mini { background: transparent; }
    .v-editorial-mini .title {
      font-family: 'Playfair Display', Georgia, serif;
      font-size: 22px;
    }

    /* Variant: masonry */
    .v-masonry .cover { aspect-ratio: auto; height: auto; }
    .v-masonry .cover img { height: auto; }

    /* Variant: compact (related posts) */
    .v-compact .body { padding: 12px; gap: 6px; }
    .v-compact .title { font-size: 15px; }

    /* Variant: magazine-medium */
    .v-magazine-medium .title { font-size: 22px; }

    @media (max-width: 768px) {
      .v-list, .v-side { flex-direction: column !important; }
      .v-list .cover, .v-side .cover { flex: 0 0 auto; min-height: auto; aspect-ratio: 16 / 9; }
      .v-hero .title { font-size: 24px; }
    }
  `],
})
export class PostCardComponent {
  @Input({ required: true }) post!: PostSummary;
  @Input({ required: true }) lang!: string;
  @Input({ required: true }) display!: PublicBlogDisplaySettings;
  @Input() variant: 'default' | 'compact' | 'hero' | 'list' | 'side' | 'magazine-medium' | 'editorial' | 'editorial-mini' | 'masonry' = 'default';
  @Input() reverseSide = false;
  @Input() eagerLoadCover = false;

  t(key: string, vars?: Record<string, string | number>) { return t(this.lang, key, vars); }
  formatDate = formatDate;
  formatNumber = formatNumber;

  /** Build a srcset assuming the image URL supports `?w=` resizing.
   *  Backends that don't support it ignore the query string and serve
   *  the original, so this is safe even when the CDN is dumb. */
  srcset(url: string): string {
    const widths = [400, 800, 1200, 1600];
    const join = url.includes('?') ? '&' : '?';
    return widths.map(w => `${url}${join}w=${w} ${w}w`).join(', ');
  }
}
