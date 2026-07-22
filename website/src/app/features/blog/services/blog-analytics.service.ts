import { Injectable, inject } from '@angular/core';

import { AnalyticsService } from '../../../services/analytics.service';

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
  private clicksEnabled = false;

  /** Set from the blog settings' `tracking.clicksEnabled`. */
  setClicksEnabled(enabled: boolean): void {
    this.clicksEnabled = enabled;
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
