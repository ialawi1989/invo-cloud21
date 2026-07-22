/**
 * Site-wide storefront tracking / marketing settings.
 *
 * These apply to the WHOLE storefront (every route — home, products,
 * collections, blog), so they live here at the app level rather than inside the
 * blog feature. Blog-specific tracking (e.g. post-click events) extends this in
 * `PublicBlogTrackingSettings`.
 *
 * All fields are optional: a field being present is what turns the corresponding
 * tag on. Secrets (e.g. the Conversions API token) are never included — they
 * stay server-side.
 */
export interface StorefrontTrackingSettings {
  /** GA4 measurement id (e.g. `G-XXXXXXXX`). Present → load gtag.js + page views. */
  ga4MeasurementId?: string;
  /** Google Search Console token → `<meta name="google-site-verification">` in <head>. */
  gscVerification?:  string;
  /** Marketing Tools → Google Tag. GTM container (`GTM-…`) or a gtag id
   *  (`GT-/G-/AW-…`). Present → inject the tag on every page. */
  googleTagId?:      string;
  /** Marketing Tools → Facebook Pixel. Numeric Meta Pixel id. Present → inject
   *  the pixel on every page. (The Conversions API token is a server-side
   *  secret and is never sent to the browser.) */
  facebookPixelId?:  string;
  /** Meta (Facebook) domain-verification token — the `content` value from
   *  Meta's meta-tag method. Present → render
   *  `<meta name="facebook-domain-verification">` in <head> (SSR). Lets a
   *  custom-domain tenant verify their own domain in Business Manager. */
  facebookDomainVerification?: string;
}
