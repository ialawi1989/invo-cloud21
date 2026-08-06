# Pages & settings refactor

How storefront pages and website settings were restructured, what was built
where, and what is still open.

> **Status — accurate as of 2026-08-06.**
>
> Sections 1–7 (the design, file maps and relocation policy) describe shipped
> code and are complete.
>
> **Status** is the section that goes stale. Read it with its own verification
> labels rather than assuming: it distinguishes what was checked by a **live
> call**, by a **database query**, and what only **type-checks**. The renderer
> table's `verified on` column separates the **real path** (the new endpoints,
> live since 2026-08-06) from the **fallback path** (the compatibility layer) —
> most renderers are still only verified on the fallback, and that distinction
> is the point of the table.
>
> Known incomplete at time of writing: the manifest being admin-only is
> **UNVERIFIED** (needs an admin token — a 401 cannot distinguish "protected"
> from "not mounted"); `system` has no renderer verification because no such
> page exists on any tenant; `account` and `booking` have never run against real
> signed-in data; `category-list` remains on the legacy endpoint because no
> unified categories endpoint exists.

Repos touched:

- `angular-customizer/invo-portal2` — admin portal (:4700)
- `angular-customizer/website` — storefront, Angular SSR (:4600)
- `D:\Projects\InvoCloudBack` — backend. **All new files** under
  `src/modules/website/`, plus two additive migrations.

---

## 1. The problem

Four things were wrong with the old model.

**Pages were code, not data.** Every page type was a hardcoded route →
component pair. `/menu` and `/shop` needed two of everything, and adding a page
type meant editing three repos.

**Two product listings with no identity.** `menu` and `shop` both list products.
Both existed because the storefront view depends on company type — but some
companies use both. With a product reachable from either, a "back" button or a
breadcrumb could not know where the visitor came from.

**Settings were spread across four untyped blobs.** "Website settings" lived in
four `WebSiteBuilder` row types — `ThemeSettings`, `OldThemeSettings`,
`SeoSettings`, `BlogSettings` — each with its own load path. Anything wanting
the logo, the shipping mode and the blog languages made three round trips and
guessed at shapes.

**Some options encoded the wrong idea.** `redirect_to_shop` is the clearest
example: a boolean on one page that hardcodes a redirect to another specific
page. It cannot express "this page redirects elsewhere", only "menu goes to
shop".

## 2. The model

A page row says what it **is**. Everything else follows from that.

```text
content · product-list · product-detail · category-list
system  · cart · checkout · account · booking
```

`pageType` decides three things at once:

1. which widgets the builder offers (`allowedWidgets`)
2. which settings the page exposes
3. which renderer the storefront mounts

Adding a page type is now one manifest entry plus one component in the
storefront's switch. No routing changes, no dashboard changes.

### Type inference (why the migration is optional)

When `pageType` is absent it is derived, in this order:

```text
template.pageType  →  template.templateType  →  slug  →  content
```

Both frontends implement the same chain, so an unmigrated row resolves
identically to a migrated one. Running the backfill is an optimisation, not a
prerequisite.

*(Worth noting: a page appearing as "Content" was traced to
`template.templateType`, not to a missing slug or an empty manifest — the
inference order matters when diagnosing.)*

### Page status replaces `redirect_to_shop`

`status` is `published | hidden | redirect`, with `redirectTo` naming the
target. It is a property of the page, works for any page and any target, and is
knowable *before* the page paints — the storefront applies it in `page-host`
ahead of rendering. The legacy boolean is still read when `status` is absent.

## 3. Backend — `src/modules/website/`

All new files; no existing code was modified for this work.

```text
pageTypes/
  pageTypes.manifest.ts     PAGE_TYPES (9 defs) + COMMON_PAGE_FIELDS,
                            LEGACY_SLUG_PAGE_TYPES / _SOURCES,
                            LEGACY_TEMPLATE_TYPES / _SOURCES,
                            COMPANY_TYPE_SEEDS, PAGE_STATUSES,
                            withRelocations(), buildManifest(),
                            PAGE_TYPES_VERSION = '1.0.0'
  optionRelocations.ts      OPTION_RELOCATIONS + relocationFor()
  pageTypes.routes.ts       GET /pageTypes, /pageTypes/version, /siteConfigSchema
  README.md                 mount instructions + relocation policy
listing/
  listing.controller.ts     getListing -> { groups, count, hasNext, source }
  productKey.controller.ts  resolve a product by uuid OR slug
  listing.routes.ts
siteConfig/
  siteConfig.types.ts       LEGACY_TYPES, SECTION_SOURCES, THEME_SECTION_KEYS
  siteConfig.repo.ts        read = projection over legacy rows; write = shallow merge
  siteConfig.schema.ts      SITE_CONFIG_SCHEMA (the portal's form definition)
  siteConfig.routes.ts
```

**The manifest is admin-scoped.** `/v1/app/website/pageTypes` with
`Cache-Control: private`. It describes the authoring surface, not the
storefront, so the public site never fetches it — see §5.

**Site config is a projection, not a new row.** Sections map onto the rows that
already exist:

| Section | Persists to |
| --- | --- |
| `branding`, `layout`, `contact`, `commerce` | `ThemeSettings` |
| `seo` | `SeoSettings` |
| `blog` | `BlogSettings` |

Keys not claimed by any section ride along in `extra`, so nothing is ever
dropped on a write. Writes are a shallow merge onto the existing blob.

## 4. Option relocations

Options were audited and moved to where they belong logically — a page-level
toggle that is really a site-wide default becomes a site default, and so on.
Relocated keys include:

```text
enableScheduleOrder     disableImmediateOrder   scheduleStartDay
disablePayLaterFor      disableDelivery         disablePickup
defaultProductStyle     defaultProductImageFit  defaultListingView
defaultPageLimit        defaultSortBy           allowLongProductName
hideOutOfStockVariants  subheader_settings      status
```

Each entry carries a `precedence` of `'default'` or `'authority'`, which decides
whether the new location seeds the old value or overrides it. `withRelocations()`
derives `deprecated` / `hint` metadata from the same map, so the portal can label
a moved option without a second list to maintain.

**The compatibility rule, in four parts:**

1. Migrations **copy, never move** — the legacy key stays exactly where it was.
2. Readers fall back to the legacy key whenever its replacement is absent.
3. Migrations only fill `NULL` targets, so re-running changes nothing.
4. `down` removes only the keys the migration added; `settings` is never touched.

Net effect: **a site that has never been migrated behaves exactly as before**,
and a migrated one behaves the same until someone edits the new value.

### Migrations

```text
1783800000000_website_page_type_backfill.js
    indexes + pageType/source, precedence templateType -> slug -> isStatic -> content,
    redirect_to_shop -> status:'redirect' + redirectTo (first catalog listing),
    published default

1783900000000_website_option_relocations.js
    MOVES[]; creates a missing ThemeSettings row;
    DISTINCT ON (companyId) ... ORDER BY createdAt ASC;
    fills NULL targets only; booking_kind from the legacy slug

1784100000000_website_backfill_reapply.js        <- corrective, run this too
    re-applies every guarded pass from BOTH files above, because both were
    edited after being applied and node-pg-migrate never re-runs a file
```

Run in that order. All are additive and idempotent.

**What `1784100000000` will change** — dry-run against the live database inside a
rolled-back transaction:

| Statement | Rows |
| --- | --- |
| `status` published default | **43** |
| `booking_kind` → appointment | **2** |
| `booking_kind` → table | **1** |
| the other 30 statements | 0 — already applied |
| **total** | **46** |

A second consecutive run changes **0 rows**, so it is idempotent against this
state. The 30 no-op statements were each proved separately on a synthesised row
(also rolled back): all 30 produce the expected value, including
`isStatic → system`, the `content` catch-all, `isHomePage → content`, and the
`booking_kind` guard correctly SKIPPING a row that has no `settings` object.

## 5. Storefront — `website/src/app/`

```text
core/page-types/page-type.types.ts
core/page-types/page-type.fallback.ts    bundled copy of the manifest
core/page-types/page-type.service.ts     settingsFor(), pageTypeFor(), statusOf()
core/pages/page.service.ts               resolves a slug to a ResolvedPage
core/site-config/site-config.service.ts  branding/layout/contact/commerce/seo/blog
features/page-host/page-host.component.ts
```

**The manifest is never fetched.** The storefront ships
`page-type.fallback.ts`, so a page renders even when the admin API is
unreachable. This is deliberate: the public site should not depend on an
admin-scoped endpoint being up.

**Settings resolve in three steps** — page value → site default → manifest
default. `SITE_DEFAULT_KEYS` maps each page setting to its site-wide
counterpart:

```ts
product_style      -> defaultProductStyle
product_image_size -> defaultProductImageFit
default_view       -> defaultListingView
page_limit         -> defaultPageLimit
sort_By            -> defaultSortBy
long_product_name  -> allowLongProductName
```

**`page-host` renders saved builder sections *around* the core**, so a system
page (a listing, checkout) can carry a banner or copy while keeping the thing it
exists for. A section's `slot` decides the side; anything without one sits on
top.

**Canonical product URLs** solved the two-listings problem: one product URL
(`/{lang}/product/{key}`, accepting id *or* slug) plus `?from=` carrying the
originating listing, so breadcrumbs and Back resolve correctly whichever listing
the visitor came from.

## 6. Portal — `invo-portal2/src/app/features/website/`

```text
page-types/page-type.types.ts
page-types/page-type.fallback.ts
page-types/page-type.service.ts        pageTypeForTemplateType, isDynamic, usingFallback
page-types/settings-fields.component.ts  generic renderer, manifest-driven
page-types/page-settings-form.component.ts
pages/services/website-pages.service.ts  fromRow(): parseTemplate + precedence,
                                         still writes isStatic for legacy readers
pages/pages-list/                        <app-list-page>, kind filter, status chips
pages/page-form/                         status + redirect target + builder link
pages/page-editor/                       settings panel + canvas, every type
site-config/site-config.schema.ts
site-config/site-config.service.ts
site-config/website-settings.component.ts
page-builder/                            customizer, control-panel, preview-frame,
                                         dynamic, theme-manager, navigation-builder
```

Routes added: `/page-builder`, `/page-builder/:id`, `/website-settings` inside
the shell, and `/page-builder/:id/editor` as a full-page builder.

**Settings forms are generated from the manifest**, not hand-written per page —
`settings-fields.component` renders whatever the manifest declares, so a new
setting is a manifest entry rather than a new component.

**The builder moved in.** It previously lived in the standalone `dashboard/`
prototype driving a demo page. It now lives in the portal, bound to real page
data: the widget library is filtered by the page type's `allowedWidgets`, the
core row is locked, and `<app-page-settings-form>` replaced the hardcoded
`STATIC_PAGE_SCHEMAS`. `dashboard/` is unused and safe to delete
(`rm -rf dashboard`).

## 7. Where a change goes now

| To change… | Edit |
| --- | --- |
| a page type's widgets or settings | `pageTypes.manifest.ts` (one entry) |
| a site-wide setting | `siteConfig.schema.ts` + the section's `SECTION_SOURCES` row |
| move an option to a better home | `optionRelocations.ts` + a migration entry |
| how a page type renders | one component in `page-host`'s switch |
| add a page type | manifest entry + storefront component |

Nothing on that list requires a routing change.

---

## Status

### Renderers — 8 of 9

Verified as of 2026-08-06, against tenant `shussain`. **The `verified on` column
is the point of this table** — most rows still say fallback.

| Type | Renders | Verified on |
| --- | --- | --- |
| `product-list` | yes | **REAL PATH** — `website/getListing`, shop + menu |
| `product-detail` | yes | **REAL PATH** — `website/getProductByKey` |
| `content` | yes | fallback |
| `category-list` | yes | fallback — no unified endpoint exists for categories |
| `cart` | yes | fallback — browser end-to-end |
| `checkout` | yes, **PickUp only** | fallback — browser end-to-end, real orders |
| `account` | signed-out state only | fallback — **never run with a signed-in shopper** |
| `booking` | branch list only | fallback — **reservation submit never executed** |
| `system` | **not verified** | — no `system` page exists on any tenant |

Site config also moved to the real path (the projection, not legacy reads).

The rows still marked `fallback` render through the compatibility layer. That
layer was the safety net, not the goal — but for `category-list` it is now the
permanent answer unless a unified categories endpoint is added.

`system` is unverified because the type has zero rows: the backfill's
`isStatic → system` rule is a last resort that only fires when nothing more
specific matched, and all 6 `isStatic:true` rows were identified by slug
(`checkout`, `menu`, `collections`, `shop`). Correct behaviour, but it means the
renderer has never been exercised.

**Checkout is PickUp-only.** `Delivery`, `Shipping` and `DineIn` are listed in
`UNSUPPORTED_SERVICES` and hidden — each fails at the last step (DineIn wants a
table; both delivery modes want an address matched against covered areas, and
every branch on the reference merchant has zero covered addresses).

### The real path is LIVE (2026-08-06)

Routers mounted in commit `1821a563c`; backend restarted (PID 31040, 11:17:17).
All four signals confirmed:

| Signal | Result |
| --- | --- |
| `getListing` echoes `source` | ✅ `{groups, count, hasNext, source}`, `source: {"kind":"catalog"}` |
| `siteConfig` returns six sections | ✅ branding, layout, contact, commerce, seo, blog (+ version, seeded, navigation, extra) |
| tenant `pageTypes` still 404 | ✅ 404 — manifest stays admin-only |
| admin `pageTypes` | 401 — auth wall; **still needs a token to confirm properly** |

### The compatibility rule, finally tested

Six pages captured on the fallback path, then re-rendered on the real path.
Raw bytes moved on all six — but that was the SSR hydration payload
(`ng-state`), which grew because `siteConfig` now returns 200 and joins the
transfer cache. Comparing **rendered DOM only**, with `ng-state` stripped:

```text
/en/shop                       24145 -> 24145   IDENTICAL
/en/menu                       54324 -> 54324   IDENTICAL
/en/categories                 81213 -> 81213   IDENTICAL
/en/cart                       13036 -> 13036   IDENTICAL
/en/checkout                   13413 -> 13413   IDENTICAL
/en/product/cevirme-shawarma   15973 -> 15973   IDENTICAL
```

Byte-identical on every page — and genuinely via the new endpoints, per the
SSR transfer cache:

| Page | Before (legacy) | After (real path) |
| --- | --- | --- |
| shop | `shop/getCategoriesProducts` | **`website/getListing`** |
| menu | `shop/menu/getCompanyMenu` | **`website/getListing`** |
| product | `shop/generalSearch` + `shop/getProduct` | **`website/getProductByKey`** |
| categories | `shop/getCompanyCategories` | unchanged — no unified endpoint exists for it |

Two different legacy endpoints collapsed into one `getListing` and produced the
same HTML. The product page dropped from two calls to one: `getProductByKey`
resolves slug-or-UUID directly, so the `generalSearch` round-trip disappeared
(the only page whose payload got *smaller*).

**`count` is not new arithmetic.** For `kind: 'catalog'`, `getListing` delegates
to `ShopRepo.getCategoriesProducts` — the same repo function the legacy path
called — and passes its `count` through verbatim. Verified: both report
**9856**. Note the raw table holds 10,196 non-deleted rows of listable types, so
the endpoint applies a further filter worth ~340 rows; that filter is
pre-existing and **identical on both paths**, not something the refactor
introduced.

### How to mount them

Both mount points are `/website`, because that is the prefix both apps already
call. **The admin path is `/v1/app/website/pageTypes`**, not `/v1/app/pageTypes`
— the portal's base URL is `.../v1/app/` and it requests `website/pageTypes`.

**1. Tenant scope** — `src/routes/v1/ecommerce/index.ts`

Add with the other imports:

```ts
import websiteListing    from '@src/modules/website/listing/listing.routes';
import websiteSiteConfig from '@src/modules/website/siteConfig/siteConfig.routes';
```

Add beside the other `router.use` lines (after `router.use('/blog', blog);`):

```ts
router.use('/website', websiteListing);
router.use('/website', websiteSiteConfig);
```

**2. Admin scope** — `src/routes/v1/app/index.ts`

Add with the other imports:

```ts
import websitePageTypes  from '@src/modules/website/pageTypes/pageTypes.routes';
import websiteSiteConfig from '@src/modules/website/siteConfig/siteConfig.routes';
```

Add beside the other `router.use` lines (after `router.use('/appointments', appointments);`):

```ts
router.use('/website', websitePageTypes);
router.use('/website', websiteSiteConfig);
```

`siteConfig.routes` is mounted in **both** scopes on purpose: the storefront
reads it tenant-side, and the portal reads *and writes* it admin-side
(`POST website/siteConfig/:section`). Mounting two routers on the same path is
normal Express behaviour — each handles only the paths it declares.

### What to expect after mounting

Stops 404-ing (tenant scope, no auth needed):

```text
POST /v1/ecommerce/<sub>/website/getListing
     body {"source":{"kind":"catalog"},"page":1,"limit":24}
     -> {"success":true,"data":{"groups":[...],"count":N,"hasNext":false,"source":{...}}}
        `source` echoed back is the tell: the legacy path never returns it.

POST /v1/ecommerce/<sub>/website/getProductByKey
     body {"key":"cevirme-shawarma"}      (a UUID also works)
     -> {"success":true,"data":{ ...product... }}

GET  /v1/ecommerce/<sub>/website/siteConfig
     -> {"success":true,"data":{"branding":{...},"layout":{...},"contact":{...},
                                "commerce":{...},"seo":{...},"blog":{...}}}
        All six sections present even when the merchant has set nothing —
        that is the projection working, not a passthrough.
```

Stops 404-ing (admin scope, needs a token — 401 without one is correct):

```text
GET  /v1/app/website/pageTypes          -> {"pageTypes":[ ...9 entries... ],"version":"1.0.0"}
                                           Cache-Control: private
GET  /v1/app/website/pageTypes/version  -> {"version":"1.0.0"}
GET  /v1/app/website/siteConfigSchema   -> the portal's Website-Settings form definition
POST /v1/app/website/siteConfig/:section
```

Must STILL 404 — the manifest is admin-only:

```text
GET  /v1/ecommerce/<sub>/website/pageTypes   -> 404
```

Then in the apps: the portal's `usingFallback` flips to **false**, and listing
responses carry `source`. Those two are the signal that the real path is live.

### Migrations — verified against the database

Both recorded: `1783800000000_website_page_type_backfill` and
`1783900000000_website_option_relocations` (2026-08-05).

| Claim | Result |
| --- | --- |
| `pageType` on every page row | **43/43** (13 `Page`, 30 `StaticPage`) |
| `source` on listing rows | **11**, matching the 11 `product-list` rows |
| `isStatic:true` → `system` | 6 rows, 0 mapped — **correct**, all matched earlier by slug |
| `redirect_to_shop:true` → `status:'redirect'` | **0 of 0** — only 2 rows carry the key and both are `false`, so the rule is **unexercised, not verified** |
| ThemeSettings row created where missing | 12 companies have one (of 174 with any WebSiteBuilder row) |
| relocation targets filled | partial, consistent with fill-NULL-only: `defaultListingView`/`defaultPageLimit`/`defaultSortBy` 8 each, `disableDelivery`/`disablePickup`/`scheduleStartDay`/`allowLongProductName` 5, `defaultProductStyle`/`enableScheduleOrder` 6, `disableImmediateOrder`/`defaultProductImageFit` 1, `disablePayLaterFor`/`hideOutOfStockVariants` 0 (no sources existed) |
| `booking_kind` backfill | **0 of 3 booking pages — never ran.** See below |
| `status` on every page row | **0 of 43** — the `published` default is unconditional, so this is proof the later passes never ran |

**Resolved 2026-08-06.** `1784100000000_website_backfill_reapply` applied at
08:18:07Z, and the result matched the dry-run prediction exactly:

| After | Value |
| --- | --- |
| `status` | **43/43** — all `published`, 0 redirect, 0 hidden |
| `booking_kind` | appointments → `appointment` ×2, table-reservation → `table` |
| `pageType` / `source` | 43 / 11 — unchanged, as predicted |
| `system` | still 0 rows |

**`booking_kind` never executed.** The statements were appended to
`1783900000000` *after* it had been applied (migration recorded 14:29:11 +0300,
commit `7149c7b71` at 14:34:24 +0300). `node-pg-migrate` tracks by file name, so
an edited file is never re-run. Without it, every migrated `appointments` page
presents a **table reservation form**, because `booking_kind` defaults to
`'table'`. Fixed by a new migration,
`1784100000000_website_booking_kind_backfill.js` — **not yet run**.

### Done since

- **SEO overrides now reach the storefront.** An earlier note here claimed the
  `/seoOverride/*` endpoints don't exist in InvoCloudBack — **that was wrong**.
  They exist (`routes/v1/app/company.ts:155-160`, controller, repo,
  `SeoOverrides` table, migration `1779800300000`). Only the read was missing:
  `shop/getProduct` now attaches the row as `seo`, the field
  `generateMetaTags` already reads.
- **`hidden` emits `noindex, nofollow`**, set before render so it lands in the
  SSR HTML. Other statuses *remove* the tag rather than writing `index, follow`,
  so a deliberate site-wide noindex isn't overridden.

### Open

- ~~Mount the four routers~~ — **done** (`1821a563c`), all four signals verified.
- ~~Run the corrective migration~~ — **done**, `1784100000000_website_backfill_reapply`,
  46 rows, matching the dry run exactly.
- **`hidden` navigation exclusion** — the remaining half. The storefront gets
  navigation as an already-built menu and never holds the full page list, so it
  cannot tell which items point at hidden pages without fetching every page.
  Belongs server-side, in the navigation endpoint.
- **Manifest admin-only: UNVERIFIED.** `/v1/app/*` returns 401 for real and
  nonexistent routes alike, so a 401 cannot distinguish "protected" from "not
  mounted". Needs an admin token. Do not assert it until then.
- **`redirect` status is unexercised** — no row in the database uses it.
- **Section `slot`** (top/bottom) is honoured by the storefront, no builder UI.
- **`primaryListingSlug`** used by renderers, not by navigation or a home redirect.
- **Static pages in the builder.**
- Two external Website-Settings links (`settings/seo`, `settings/blog`) point at
  unverified routes.
