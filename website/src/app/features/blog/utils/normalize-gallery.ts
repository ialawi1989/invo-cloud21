/**
 * Strip the editor's JS-computed inline layout styles from gallery tiles.
 *
 * The dashboard lays out masonry/collage galleries with JavaScript, baking
 * fixed px `width`/`height`/`flex` onto each `.re-gallery-item` — sized for
 * the editor's own canvas width. Those inline styles are saved with the
 * content, so on the storefront (a different width) the tiles scatter and
 * overflow. Removing them lets the site's responsive CSS lay each layout
 * out for the real container.
 *
 * Pure string transform → SSR-safe and runs before innerHTML.
 */
export function normalizeGalleryHtml(html: string): string {
  if (!html || html.indexOf('re-gallery-item') < 0) return html;
  return html.replace(
    /(<div\b[^>]*\bclass="[^"]*\bre-gallery-item\b[^"]*"[^>]*?)\s+style="[^"]*"/gi,
    '$1',
  );
}
