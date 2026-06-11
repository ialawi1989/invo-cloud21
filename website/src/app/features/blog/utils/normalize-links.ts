/**
 * Give bare-domain links an explicit scheme so the browser treats them as
 * absolute external URLs.
 *
 * The editor lets authors type `www.google.com` (no scheme). Without a
 * scheme the browser resolves it RELATIVE to the current page — e.g.
 * `…/en/www.google.com` — so the link 404s on the storefront. Here we
 * prepend `https://` to any `<a href>` that is a bare domain, leaving
 * already-schemed, root-/protocol-relative, anchor, mailto and tel links
 * untouched.
 *
 * Pure string transform → SSR-safe; runs before innerHTML.
 */
export function normalizeLinkHrefs(html: string): string {
  if (!html || html.indexOf('href') < 0) return html;
  return html.replace(
    /(<a\b[^>]*\bhref=")([^"]*)(")/gi,
    (_m, pre: string, url: string, post: string) => pre + fixUrl(url) + post,
  );
}

function fixUrl(url: string): string {
  const u = (url || '').trim();
  if (!u) return url;
  // Already absolute / relative / anchor / mailto / tel → leave as-is.
  if (/^(https?:\/\/|\/\/|mailto:|tel:|\/|#|\?)/i.test(u)) return url;
  return 'https://' + u;
}
