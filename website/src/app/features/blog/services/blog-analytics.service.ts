import { Injectable, inject } from '@angular/core';

import { AnalyticsService } from '../../../services/analytics.service';
import { MarketingToolsService } from '../../../services/marketing-tools.service';

/**
 * Blog-specific analytics — the post-click ("select_content") events.
 *
 * The site-wide analytics (GA4 page views, GSC / Meta verification) live in the
 * app-level {@link AnalyticsService}; this class does NOT own gtag. It only adds
 * the blog's own events on top of that shared instance — "the blog picks its
 * data from the site-wide analytics" — gated on the blog's `clicksEnabled` flag.
 */
@Injectable({ providedIn: 'root' })
export class BlogAnalyticsService {
  private analytics = inject(AnalyticsService);
  private marketing = inject(MarketingToolsService);
  private clicksEnabled = false;

  /** Set from the blog settings' `tracking.clicksEnabled`. */
  setClicksEnabled(enabled: boolean): void {
    this.clicksEnabled = enabled;
  }

  /**
   * A blog post was opened. Records it on both tools so a content site's traffic
   * is usable: GA4 gets an explicit `blog_post_view` event (the automatic
   * page_view already fires, this one is content-labelled for reports), and the
   * Meta Pixel gets a `ViewContent` so readers can be built into retargeting
   * audiences. Both no-op unless their tool is active. Not gated on
   * `clicksEnabled` — that flag is only about click events.
   */
  trackPostView(post: { slug: string; title: string }): void {
    this.analytics.event('blog_post_view', {
      content_type: 'blog_post',
      item_id:      post.slug,
      item_name:    post.title,
    });
    this.marketing.trackViewContent({
      content_type: 'article',
      content_ids:  [post.slug],
      content_name: post.title,
    });
  }

  /** Fire a GA4 content-selection event for a clicked post. Gated on
   *  `clicksEnabled`; safe to call unconditionally from templates. */
  trackPostClick(post: { slug: string; title: string }): void {
    if (!this.clicksEnabled) return;
    this.analytics.event('select_content', {
      content_type: 'blog_post',
      item_id:      post.slug,
      item_name:    post.title,
    });
  }
}
