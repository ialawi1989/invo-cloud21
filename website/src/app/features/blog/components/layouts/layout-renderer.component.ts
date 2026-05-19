import { Component, Input, ChangeDetectionStrategy, signal, inject, PLATFORM_ID, OnInit } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';

import { PostSummary } from '../../models/blog.types';
import { FeedLayout, PublicBlogDisplaySettings, PublicBlogMobileSettings } from '../../models/blog-settings.types';
import { PostCardComponent } from '../post-card.component';

/**
 * Picks the matching layout based on `BlogSettings.layouts.feed` (or
 * `.categoryFeed`). All six layouts consume the same `posts` array;
 * the renderer's only job is the dispatch.
 *
 * Mobile override: when `BlogSettings.mobile.overrideDesktop` is on
 * and the viewport is below 768px, swap to `mobile.feedLayout`. The
 * check runs on a ResizeObserver so rotating tablets doesn't get
 * stuck on the wrong layout.
 */
@Component({
  selector: 'app-layout-renderer',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, PostCardComponent],
  template: `
    @switch (resolvedLayout()) {
      @case ('grid')      { <ng-container *ngTemplateOutlet="grid"></ng-container> }
      @case ('list')      { <ng-container *ngTemplateOutlet="list"></ng-container> }
      @case ('masonry')   { <ng-container *ngTemplateOutlet="masonry"></ng-container> }
      @case ('magazine')  { <ng-container *ngTemplateOutlet="magazine"></ng-container> }
      @case ('sideBySide'){ <ng-container *ngTemplateOutlet="sideBySide"></ng-container> }
      @case ('editorial') { <ng-container *ngTemplateOutlet="editorial"></ng-container> }
    }

    <!-- 1. GRID -->
    <ng-template #grid>
      <div class="grid">
        @for (p of posts; track p.id; let i = $index) {
          <app-post-card [post]="p" [lang]="lang" [display]="display"
                         [eagerLoadCover]="i < 3"></app-post-card>
        }
      </div>
    </ng-template>

    <!-- 2. LIST -->
    <ng-template #list>
      <div class="list">
        @for (p of posts; track p.id; let i = $index) {
          <app-post-card variant="list" [post]="p" [lang]="lang" [display]="display"
                         [eagerLoadCover]="i < 2"></app-post-card>
        }
      </div>
    </ng-template>

    <!-- 3. MASONRY -->
    <ng-template #masonry>
      <div class="masonry">
        @for (p of posts; track p.id; let i = $index) {
          <div class="masonry-item">
            <app-post-card variant="masonry" [post]="p" [lang]="lang" [display]="display"
                           [eagerLoadCover]="i < 3"></app-post-card>
          </div>
        }
      </div>
    </ng-template>

    <!-- 4. MAGAZINE: 1 hero, 2 medium, rest 3-col -->
    <ng-template #magazine>
      @if (posts[0]; as hero) {
        <app-post-card class="mag-hero" variant="hero"
                       [post]="hero" [lang]="lang" [display]="display"
                       [eagerLoadCover]="true"></app-post-card>
      }
      @if (posts.length > 1) {
        <div class="mag-medium">
          @for (p of posts.slice(1, 3); track p.id) {
            <app-post-card variant="magazine-medium" [post]="p" [lang]="lang" [display]="display"></app-post-card>
          }
        </div>
      }
      @if (posts.length > 3) {
        <div class="grid">
          @for (p of posts.slice(3); track p.id) {
            <app-post-card [post]="p" [lang]="lang" [display]="display"></app-post-card>
          }
        </div>
      }
    </ng-template>

    <!-- 5. SIDE BY SIDE -->
    <ng-template #sideBySide>
      <div class="side-stack">
        @for (p of posts; track p.id; let i = $index) {
          <app-post-card variant="side" [post]="p" [lang]="lang" [display]="display"
                         [reverseSide]="i % 2 === 1"
                         [eagerLoadCover]="i < 2"></app-post-card>
        }
      </div>
    </ng-template>

    <!-- 6. EDITORIAL -->
    <ng-template #editorial>
      <div class="editorial">
        @for (p of posts; track p.id; let i = $index) {
          <app-post-card [variant]="i % 4 === 0 ? 'editorial' : 'editorial-mini'"
                         [post]="p" [lang]="lang" [display]="display"></app-post-card>
        }
      </div>
    </ng-template>
  `,
  styles: [`
    :host { display: block; }
    .grid {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 24px;
    }
    .list { display: flex; flex-direction: column; gap: 20px; }

    .masonry {
      column-count: 3;
      column-gap: 24px;
    }
    .masonry-item { break-inside: avoid; margin-bottom: 24px; }

    .mag-hero { display: block; margin-bottom: 32px; }
    .mag-medium {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 24px;
      margin-bottom: 32px;
    }

    .side-stack { display: flex; flex-direction: column; gap: 24px; }

    .editorial {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 40px;
      font-family: Georgia, 'Playfair Display', serif;
    }

    @media (max-width: 1024px) {
      .grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      .masonry { column-count: 2; }
    }
    @media (max-width: 640px) {
      .grid { grid-template-columns: 1fr; }
      .masonry { column-count: 1; }
      .mag-medium, .editorial { grid-template-columns: 1fr; }
    }
  `],
})
export class LayoutRendererComponent implements OnInit {
  @Input({ required: true }) posts: PostSummary[] = [];
  @Input({ required: true }) layout!: FeedLayout;
  @Input({ required: true }) lang!: string;
  @Input({ required: true }) display!: PublicBlogDisplaySettings;
  @Input() mobile?: PublicBlogMobileSettings;

  private platformId = inject(PLATFORM_ID);
  private isMobile = signal(false);

  resolvedLayout = () => {
    if (this.mobile?.overrideDesktop && this.isMobile()) {
      return this.mobile.feedLayout;
    }
    return this.layout;
  };

  ngOnInit(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    const mq = window.matchMedia('(max-width: 768px)');
    this.isMobile.set(mq.matches);
    const onChange = (e: MediaQueryListEvent) => this.isMobile.set(e.matches);
    mq.addEventListener?.('change', onChange);
  }
}
