# Public Blog

Visitor-facing blog pages for the company website. Lives at
`/:lang/blog/*` and is independent of the dashboard (`invo-portal2`).

This module does NOT use any mock data — every page hits a real
public API endpoint. If an endpoint is offline, the page surfaces a
graceful error banner, never a placeholder.

---

## Folder layout

```
features/blog/
  blog.routes.ts               # lang-prefixed routes, langGuard
  README.md                    # this file
  models/                      # wire types + settings shape
  services/
    public-blog-api.service.ts # HttpClient → /api/public/blog/*
    blog-settings.service.ts   # one-shot settings cache (per session)
    blog-seo.service.ts        # Meta/Title + hreflang + JSON-LD
    shopper-auth.service.ts    # session probe + login/register/logout
  i18n/
    i18n.ts                    # UI chrome strings (en + ar shipped)
  utils/
    hashtag-linker.ts          # auto-link #hashtags in rendered HTML
  components/
    layouts/
      layout-renderer.component.ts   # picks the right layout
                                     # (Grid / List / Masonry /
                                     #  Magazine / SideBySide / Editorial
                                     #  are all inline here as templates)
    post-card.component.ts           # variants: default | compact | hero |
                                     #           list | side | magazine-medium |
                                     #           editorial | editorial-mini |
                                     #           masonry
    post-content.component.ts        # renders trusted HTML, runs hashtag linker
    related-posts.component.ts
    breadcrumbs.component.ts
    pagination.component.ts
    language-switcher.component.ts
    blog-header.component.ts         # logo + search + lang switcher
    category-menu-strip.component.ts
    author-card.component.ts
    share-buttons.component.ts
    ui-bits.component.ts             # loading skeleton, empty state, error banner
    comments/
      comment-section.component.ts
      comment-item.component.ts
  pages/
    blog-index.component.ts
    post.component.ts
    category.component.ts
    tag.component.ts
    author.component.ts
    search.component.ts
    not-found.component.ts
```

---

## API endpoints used

RPC-style — every read and write is
`POST /v1/ecommerce/<company>/blog/<action>` with a JSON body (use
`{}` for no-args calls). The `<company>` segment is the tenant slug
(same value as the `X-Sub-Domain` header) so e.g. the settings call
on `https://shussain.dev.invopos.shop` resolves to
`POST https://shussain.dev.invopos.shop/v1/ecommerce/shussain/blog/getSettings`.

RSS and sitemap are the two GETs. All paths are appended to
`environment.apiBase`. The service module that wires them is
`services/public-blog-api.service.ts`.

| Method | Path                                              | Body |
| ------ | ------------------------------------------------- | ---- |
| POST   | `/v1/ecommerce/<subDomain>/blog/getSettings`        | `{}` |
| POST   | `/v1/ecommerce/<subDomain>/blog/getPostList`        | `{ page, limit, searchTerm, sortBy: { sortValue, sortDirection }, filter: { status?, language, taxonomyId?, authorEmployeeId? } }` |
| POST   | `/v1/ecommerce/<subDomain>/blog/getPost`            | `{ slug, language }` (or `{ id }`) |
| POST   | `/v1/ecommerce/<subDomain>/blog/getTaxonomyList`    | `{ page, limit, searchTerm, sortBy, filter: { taxonomyType, language? } }` |
| POST   | `/v1/ecommerce/<subDomain>/blog/getCategoryPosts`   | `{ slug, language, page?, limit? }` |
| POST   | `/v1/ecommerce/<subDomain>/blog/getTagPosts`        | `{ slug, language, page?, limit? }` |
| POST   | `/v1/ecommerce/<subDomain>/blog/getAuthorProfile`   | `{ authorEmployeeId }` |
| POST   | `/v1/ecommerce/<subDomain>/blog/getPostComments`    | `{ postId, page?, limit? }` |
| POST   | `/v1/ecommerce/<subDomain>/blog/createComment`      | `{ postId, content, parentCommentId?, language? }` |
| POST   | `/v1/ecommerce/<subDomain>/blog/updateOwnComment`   | `{ id, content }` |
| POST   | `/v1/ecommerce/<subDomain>/blog/deleteOwnComment`   | `{ id }` |
| GET    | `/v1/ecommerce/<subDomain>/blog/rss?lang=`          | — |
| GET    | `/v1/ecommerce/<subDomain>/blog/sitemap.xml`        | — |

Every response is wrapped: `{ success: boolean, msg: string, data: any }`.
The api client unwraps `data` and throws an `Error(msg)` (with
`error.status` and `error.code` attached) when `success` is false or
the call returns a non-2xx — pages catch and surface the message.

Author profile is keyed by `authorEmployeeId` only — no slug
lookup. Public author URLs are therefore
`/:lang/blog/authors/<employeeId>`. Post-card author links use
`post.author.id` directly.

Comments are keyed by `postId`, not slug — the post page passes
`post.id` (returned from `getPost`) into the comment section.

### Required headers

Every request includes:

- `X-Sub-Domain: <tenant>` — resolves the tenant company. The value
  comes from `window.__BLOG_SUBDOMAIN__` (override) or the first
  label of `window.location.hostname`.

Comment-write calls additionally send:

- `X-Shopper-Session: <sessionId>` (when
  `ShopperAuthService.sessionId()` is set) **and** mirror the same
  value into the body as `userSessionId`. The backend accepts
  either.

Employee-auth headers are never sent on these calls.

### Response envelope

Every read returns `{ data: … }` (paged endpoints also include
`pagination`, list endpoints with side blocks include extra fields
like `category` or `tag`). The api client unwraps `data` for you, so
pages consume the inner payload directly.

### Error envelope

Errors come back as `{ error: { code, message, details? } }` with
the HTTP status. The comment section maps codes to user-facing copy:

| Code              | HTTP | UI message |
| ----------------- | ---- | ---------- |
| `RATE_LIMITED`    | 429  | "You're posting too quickly — please try again in a moment." |
| `UNAUTHORIZED`    | 401  | "Please sign in to leave a comment." |
| `FORBIDDEN`       | 403  | "You don't have permission to do that." |
| `COMMENTS_DISABLED` | 403 | "Comments are disabled for this post." |
| `DEPTH_EXCEEDED`  | 400  | "Reply depth limit reached." |
| `VALIDATION_FAILED` | 422 | falls back to server `message` |
| `NOT_FOUND`       | 404  | surfaces a 404 view on read pages |

### Language fallback notice

Every post object includes `contentLanguage`, `requestedLanguage`,
and `wasFallback`. When `wasFallback === true` the post page renders
a small banner above the cover: *"This article isn't available in
your language yet — showing the &lt;native-language-name&gt; version
instead."* The banner is purely informational; the page still
renders the post in `contentLanguage`.

### CORS

The page calls a different origin in dev, so the backend must return:

- `Access-Control-Allow-Origin: <page origin>` (not `*`, because we
  send credentials)
- `Access-Control-Allow-Credentials: true`
- `Access-Control-Allow-Headers: Content-Type, X-Sub-Domain, X-Shopper-Session`
- `Access-Control-Allow-Methods: GET, POST, OPTIONS`

---

## Configuring the API base

`environment.apiBase` resolves at runtime — local hosts (`localhost`,
`10.*`, `192.168.*`, `172.16-31.*`) point at `http://localhost:3000`,
everything else uses an empty string (same-origin).

Override per deployment:

```html
<!-- inject before the bundle loads -->
<script>window.__BLOG_API_BASE__ = 'https://api.example.com';</script>
```

---

## Adding a 7th layout variant

1. Add the variant key to `FeedLayout` in
   `models/blog-settings.types.ts` and to the `FEED_LAYOUTS` array.
2. Add a corresponding `<ng-template>` in
   `components/layouts/layout-renderer.component.ts` and a `@case`
   entry in the `@switch` block. The template receives no inputs —
   it iterates over `posts` directly.
3. If the new layout needs a new card *shape* (e.g. "card flipped on
   hover"), add a new value to the `variant` union in
   `post-card.component.ts` and CSS rules under `.v-newvariant`.
4. Update the dashboard settings UI (in `invo-portal2`) so editors
   can pick the new layout. The frontend will start using it as soon
   as the value is saved into BlogSettings.

The layout consumes the same `PostSummary[]` shape every other
layout consumes, so no per-card data mapping is required.

---

## RTL flipping

RTL is driven entirely by `BlogSettings.languages.rtlLanguages`. The
boot sequence on every page is:

1. Settings load.
2. `BlogSeoService.setLangAndDir(lang, rtl)` writes `<html lang="…"
   dir="rtl|ltr">`.
3. CSS picks up the dir from `<html>` and from any `[dir='rtl']`
   selectors in component styles.

Every spacing rule that could leak left/right uses CSS logical
properties:

- `margin-inline-start` / `margin-inline-end`
- `padding-inline-start` / `padding-inline-end`
- `inset-inline-start` / `inset-inline-end`
- `border-inline-start` / `border-inline-end`
- `text-align: start | end` (where applicable)

Directional icons (chevrons, breadcrumb separators) are flipped
visually with `transform: scaleX(-1)` under `[dir='rtl']`.

To add an RTL-only font (Arabic, Hebrew, etc.), add `@font-face`
declarations to `src/styles.css` and the family to the `body` font
stack with `unicode-range:` so the right glyph set kicks in
automatically.

---

## Language switching

`LanguageSwitcherComponent` has two modes:

- **Default** — replaces the first URL segment with the new lang.
  Works on the feed, category, tag, author, and search pages
  because their slugs are language-independent (or live on a
  language-independent profile slug, in the author case).
- **Per-post override** — the post page passes `urlFor(lang)`
  that resolves to the translated slug from
  `post.seo.hreflangAlternates`. If no translation exists for the
  target language, the switcher falls back to `/:newLang/blog`.

The supported language list comes from
`BlogSettings.languages.supported`; the switcher hides itself when
only one language is configured.

---

## SEO

`BlogSeoService` is the single place that writes to `<head>`. Every
page calls `apply(...)` exactly once per data load with:

- `<title>` and meta description
- `og:title` / `og:description` / `og:image` / `og:url` / `og:type`
  / `og:locale` / `og:site_name`
- `twitter:card` / `twitter:title` / `twitter:description` /
  `twitter:image`
- `<link rel="canonical">`
- `<link rel="alternate" hreflang>` per supported language
- `<link rel="alternate" type="application/rss+xml">` to the RSS
  feed
- `robots: noindex, nofollow` when `noindex: true` (search results,
  thin tag pages)
- For posts: `article:published_time`, `article:modified_time`,
  `article:author`

JSON-LD blocks (`@type: BlogPosting` + `BreadcrumbList` on posts,
`@type: Person` on authors) are appended via
`setJsonLd(...)`. Each call replaces the previous block, so SPA
navigation doesn't leak stale schema data.

### Server-side rendering (REQUIRED for crawlers)

This bundle is **SSR-ready but not SSR-bootstrapped** out of the
box. Enable it with:

```bash
cd website
ng add @angular/ssr
```

That command will:

- create `src/main.server.ts` and `src/server.ts`
- patch `angular.json` with `server` and `prerender` targets
- update `main.ts` / `app.config.ts` for hydration

After running it, no code changes are required — every page already
uses `Meta` / `Title` / a `DOCUMENT`-aware SEO service that writes
into the server response, every `window` / `navigator` access is
guarded by `isPlatformBrowser`, and the API service uses
`HttpClient` (which respects the SSR fetch shim with `withFetch()`).

### Cache strategy

The cache headers are set by the backend. The frontend simply tells
the SSR server how long the rendered HTML may live in the CDN:

| Route                          | Recommended `Cache-Control`              |
| ------------------------------ | ---------------------------------------- |
| `/:lang/blog`                  | `public, max-age=0, s-maxage=300, stale-while-revalidate=600` |
| `/:lang/blog/:slug`            | `public, max-age=0, s-maxage=86400, must-revalidate` (purge on update) |
| `/:lang/blog/category/:slug`   | `public, max-age=0, s-maxage=300, stale-while-revalidate=600` |
| `/:lang/blog/tag/:slug`        | `public, max-age=0, s-maxage=300, stale-while-revalidate=600` |
| `/:lang/blog/authors/:slug`    | `public, max-age=0, s-maxage=3600` (purge on profile update) |
| `/:lang/blog/search`           | `private, no-store` |
| `/blog/rss`, `/blog/sitemap.xml` | `public, max-age=3600` |

Wire purges from the dashboard's "post updated" webhook to the CDN's
cache invalidation API.

### RSS + sitemap

Both are backend-generated and live on the same `/v1/ecommerce/blog/`
namespace as the rest of the API. The frontend exposes:

- `<link rel="alternate" type="application/rss+xml" href="…/v1/ecommerce/blog/rss?lang=…">`
  on every page via `BlogSeoService.apply({ rss: api.rssUrl(lang) })`
- Optional "Subscribe to RSS" link in your footer pointing at the
  same URL

`api.sitemapUrl()` returns `<apiBase>/v1/ecommerce/blog/sitemap.xml` —
reference that from `/robots.txt` (`Sitemap: …`).

---

## Comments + shopper auth

`CommentSectionComponent` owns the entire commenting UX:

- thread fetch on mount (and after every mutation)
- top-level compose form (or inline reply if `replyTo` is set)
- recursive `CommentItemComponent` honouring
  `BlogSettings.comments.maxDepth`
- own-comment edit/delete (visible when `comment.canEdit` is true —
  set server-side based on `X-Shopper-Session` resolution)
- pending / deleted rendering (`comment.isPending` / `comment.isDeleted`;
  `content` is `null` when deleted, so the UI shows `[Comment
  deleted]`)
- "Sign in to comment" CTA when
  `BlogSettings.comments.requireShopperLogin && !shopperAuth.current`

`ShopperAuthService` is now a thin state holder — it does **not**
issue auth network calls (those endpoints weren't part of the
public-blog migration). Drive it from your shell:

```ts
shopperAuth.setSession(shopperProfile, sessionId);   // after login
shopperAuth.clear();                                  // on sign-out
```

It also hydrates from `localStorage` keys `shopperSession` and
`shopperProfile` on the browser tick, so if your existing shopper
flow writes to those keys the blog will pick the session up
automatically.

The session value is sent on every comment-write call as both
`X-Shopper-Session: <id>` (header) and `userSessionId` (body) — the
backend accepts either.

---

## Hashtag auto-linking

`utils/hashtag-linker.ts` walks the rendered post HTML and converts
`#word` sequences inside text nodes into anchors pointing at
`/:lang/blog/tag/:hashtag`. It skips `<a>`, `<code>`, `<pre>`,
`<script>`, and `<style>` so we don't double-link or mangle code
blocks. On SSR (no DOMParser) it falls back to a regex with a tag-
state machine that achieves the same outcome.

If your backend already auto-links, set the post content's anchors
to use `class="blog-hashtag"` so the styling rule in
`post-content.component.ts` still applies.

---

## Accessibility

- Every image uses `alt="Cover image for {title}"` (post lists) or
  the author's name (avatars).
- One `<h1>` per page; headings inside post content respect the
  hierarchy set by the editor.
- Focus rings inherit from the browser default plus
  `outline-offset: 1px` on form controls.
- Comment form `<textarea>` carries `aria-label`.
- Language switcher menu uses `role="menu"` / `role="menuitem"`.
- All icon-only buttons (share row, comment actions) include text
  labels — there are no purely-iconic interactions.

---

## Performance

- Cover images: lazy-loaded by default; the first 2–3 in a list and
  the post page hero use `loading="eager" fetchpriority="high"`.
- `<img srcset>` with widths 400 / 800 / 1200 / 1600 — assumes your
  image service honours `?w=` in the URL. If it doesn't, the request
  falls back to the original.
- All page components are `ChangeDetection.OnPush`.
- Routes are lazy-loaded via `loadComponent`, so the blog bundle
  doesn't ship to visitors who only see the marketing pages.
- The shared `BlogSettingsService` deduplicates settings fetches per
  session — even with 10 routes mounting it in parallel only one
  network request fires.
