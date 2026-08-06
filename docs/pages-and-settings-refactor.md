# Pages & settings refactor

How storefront pages and website settings were restructured, what was built
where, and what is still open.

> **The refactor is DONE. Final state as of 2026-08-06.**
>
> Sections 1–7 (design, file maps, relocation policy) describe shipped code.
> **Status** records what was verified and how — a live call, a database query,
> or only a type-check — and keeps the **real path** (the new endpoints, live
> since 2026-08-06) separate from the **fallback path** (the compatibility
> layer). That distinction is the substance of it, not a formality.
>
> The central claim was tested rather than asserted: switching to the new
> endpoints produced **byte-identical rendered DOM** on all six sampled pages
> — for MIGRATED rows. Unmigrated-row parity is a separate question, tested
> separately (43/43) after a real inference bug was found and fixed.
>
> **One item is genuinely outstanding** — whether the manifest is admin-only is
> UNVERIFIED and needs an admin token; a 401 cannot distinguish "protected" from
> "not mounted".
>
> **Three things read as gaps and are not** — `system`, `redirect` and
> `category-list`. See *By design — NOT unfinished work* before treating any of
> them as a to-do.
>
> Everything else worth doing next is in *What to pick up next*, in priority
> order, written so it can be picked up cold.

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

### Type inference

When `pageType` is absent it is derived, in this order:

```text
template.pageType  →  template.templateType  →  slug  →  content
```

> ⚠️ **The runtime map and the migration DISAGREE, and the runtime one is
> wrong.** Corrected claim, 2026-08-06 — this section previously said an
> unmigrated row "resolves identically to a migrated one". It does not.
>
> `legacyTemplateTypes` in the manifest and in **both** bundled fallbacks
> contains `custom: 'content'` and `blog: 'content'`. The migration's
> `TEMPLATE_TYPES` contains neither.
>
> `templateType` outranks `slug`, so for a row without `pageType` the migration
> types `shop` as `product-list` (via slug) while the runtime types it
> **`content`** (via `custom`).
>
> Measured: `custom` is on **22 of 43** page rows, and those rows resolve to
> **six different page types** — product-list 11, checkout 5, booking 3,
> account 1, product-detail 1, content 1. `custom` carries no type information;
> it is a generic marker. Mapping it to `content` would mistype 21 of 22 rows.
>
> **The migration is correct. No already-migrated row is mistyped** — the
> backfill never consulted `custom`, so every row was typed by slug, `isStatic`
> or the content catch-all. The damage is confined to *unmigrated* rows, where
> the runtime inference reads `custom` and returns `content`. This is the actual
> cause of the "page appearing as Content" symptom noted during the migration.
>
> **FIXED 2026-08-06.** `custom` and `blog` removed from `legacyTemplateTypes`
> in all three copies — `pageTypes.manifest.ts` and both
> `page-type.fallback.ts` files. `blog` went too: no row used it and no `blog`
> slug rule exists, so it reached `content` via the catch-all anyway, and an
> entry that only works by accident invites the same confusion later.
>
> **Verified against every real row.** Each of the 43 page rows had `pageType`
> stripped to simulate an unmigrated row, then runtime inference was compared
> with what the migration assigned: **43/43 agree.** Re-running the same test
> with the old map gives **22/43, with 21 disagreements — every one a `custom`
> row** (`shop` → content instead of product-list, `checkout` → content,
> `appointments` → content, and so on). The test fails before the fix and passes
> after, so it is testing the thing that was broken.

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
default — **but step 2 applies to exactly six keys**, not to settings in
general. `SITE_DEFAULT_KEYS` in `page-type.service.ts` is the whole list:

```ts
product_style      -> defaultProductStyle
product_image_size -> defaultProductImageFit
default_view       -> defaultListingView
page_limit         -> defaultPageLimit
sort_By            -> defaultSortBy
long_product_name  -> allowLongProductName
```

Every other field skips straight from step 1 to step 3.

> ⚠️ **The seven `authority` relocations have no resolution path.** Corrected
> claim, 2026-08-06 — this section previously implied the chain was general.
>
> `enable_schedule_order`, `disable_immediate_order`,
> `start_day_for_schedule_order`, `disable_pay_later_for`, `disable_delivery`,
> `disable_pickup` and `disable_out_of_stock_matrix_dimensions` each have a
> destination in the relocation map and a field in the site-config schema, but
> nothing in `settingsFor()` consults them. A site-level `disableDelivery` does
> not override a page's `disable_delivery`.
>
> **This is not a plumbing gap.** Nothing reads those keys at all — neither
> the page-level name nor the site-level one appears anywhere in the storefront,
> the portal or the backend outside the manifest and schema definitions
> themselves. The old storefront DID read all seven, always from
> `pageData.template.settings.<key>`:
>
> | key | read by, in NewWebsite |
> | --- | --- |
> | the six ordering / delivery keys | `pages/checkout/checkout.component.ts`, `components/service-selector-pop/` |
> | `disable_out_of_stock_matrix_dimensions` | `components/product/product-view/matrix-options/` |
>
> The new storefront reads none of them because **the features that consume them
> are unported**: checkout is PickUp-only with no service selector, and there is
> no variant/matrix picker. Wiring site values into `settingsFor()` now would
> build resolution for something with no reader.
>
> **Correct sequencing:** port the feature first (service selector, scheduling,
> variant picker), and decide page-vs-site at that point. The relocation map
> already records the intent — `authority` means the site value should win.

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

Final state as of 2026-08-06. The refactor itself is **done**; what remains is
listed under *What to pick up next* and is separable work.

### Verified on the REAL path

The new endpoints, live since 2026-08-06 (mounted in `1821a563c`, backend
restarted, PID 31040).

| Item | How it was verified |
| --- | --- |
| `website/getListing` | live call — returns `{groups, count, hasNext, source}` |
| `website/getProductByKey` | live call — resolves slug AND uuid |
| `website/siteConfig` | live call — all six sections populated |
| Router mounts | all four signals green (see below) |
| `product-list` renderer | shop + menu both rendered via `getListing` |
| `product-detail` renderer | rendered via `getProductByKey` |
| **The compatibility rule** | **byte-identical rendered DOM across six pages** |
| Migrations | database queries — see *Migrations* |

**The four signals**

| Signal | Result |
| --- | --- |
| `getListing` echoes `source` | yes — `{"kind":"catalog"}` |
| `siteConfig` returns six sections | yes — branding, layout, contact, commerce, seo, blog |
| tenant `pageTypes` still 404 | yes — manifest stays admin-only |
| admin `pageTypes` | 401 without a token — **see UNVERIFIED below** |

**The compatibility rule, tested rather than asserted — for MIGRATED rows.**
Six pages captured on the fallback path, then re-rendered on the real path. Raw
bytes moved on all six — but that was the SSR hydration payload (`ng-state`)
growing because `siteConfig` now returns 200 and joins the transfer cache.
Comparing rendered DOM only:

```text
/en/shop                       24145 -> 24145   IDENTICAL
/en/menu                       54324 -> 54324   IDENTICAL
/en/categories                 81213 -> 81213   IDENTICAL
/en/cart                       13036 -> 13036   IDENTICAL
/en/checkout                   13413 -> 13413   IDENTICAL
/en/product/cevirme-shawarma   15973 -> 15973   IDENTICAL
```

> **What this test did and did not prove.** Every row on this database already
> carried `pageType`, so the diff exercised the *migrated* path only. It proves
> **migrated-row parity** — legacy endpoints and new endpoints render the same
> HTML for a row that has been backfilled.
>
> It says nothing about **unmigrated-row parity**, which turned out to be a
> different question with a different answer: the `custom` templateType bug
> meant an unmigrated row resolved to a different page type entirely, and the
> byte-identical diff could not have caught it. That is covered separately by
> the 43/43 inference test in *Type inference*.
>
> Two questions, two tests. Do not read either as covering the other.

And genuinely through the new endpoints, per the SSR transfer cache:

| Page | Before | After |
| --- | --- | --- |
| shop | `shop/getCategoriesProducts` | `website/getListing` |
| menu | `shop/menu/getCompanyMenu` | `website/getListing` |
| product | `shop/generalSearch` + `shop/getProduct` | `website/getProductByKey` |
| categories | `shop/getCompanyCategories` | unchanged — see *by design* |

Two different legacy endpoints collapsed into one and produced the same HTML.
The product page dropped from two calls to one, because `getProductByKey`
resolves slug-or-uuid directly and the `generalSearch` round-trip disappeared.

`count` is not new arithmetic: for `kind: 'catalog'`, `getListing` delegates to
`ShopRepo.getCategoriesProducts` and passes its `count` through verbatim. Both
paths report **9856**.

### Still on the FALLBACK path

Renders correctly, through the compatibility layer, because no unified endpoint
applies:

- `content`, `cart`, `checkout` — these page types have no listing to unify.
- `category-list` — see *by design* below.

### Verified, but not through the page-type work

`cart` and `checkout` were exercised end-to-end in a browser (real cash orders
placed), and currency was confirmed in the SSR HTML. Both predate the mount and
run on the fallback path.

### Migrations — verified against the database

| Migration | State |
| --- | --- |
| `1783800000000_website_page_type_backfill` | applied 2026-08-05, **partially** — see below |
| `1783900000000_website_option_relocations` | applied 2026-08-05, **partially** |
| `1784100000000_website_backfill_reapply` | applied 2026-08-06 08:18:07Z, **46 rows** |

Both original migrations were edited AFTER being applied, and `node-pg-migrate`
tracks by file name, so those edits never ran. The corrective migration
re-applies every guarded pass from both. Final state:

```text
pageType      43/43 page rows
status        43/43   (43 published, 0 redirect, 0 hidden)
source        11      (matching the 11 product-list rows)
booking_kind  appointments -> appointment x2, table-reservation -> table
```

The corrective migration was dry-run in a rolled-back transaction first: 46 rows
predicted, 46 changed, and a second consecutive run changed 0 — idempotent. Its
30 no-op statements were each proved separately on synthesised rows.

### UNVERIFIED — one item, needs an admin token

**Is the manifest genuinely admin-only?** `/v1/app/website/pageTypes` returns
401 without a token, but so does a route that does not exist — `/v1/app/*` sits
behind a blanket auth wall, so a 401 cannot distinguish "mounted and protected"
from "not mounted". The tenant-scoped `/v1/ecommerce/<sub>/website/pageTypes`
does return 404, which is the desired half.

To close it, both calls are needed:

```bash
# 1. WITH a token — must be 200, 9 page types, Cache-Control: private
curl -s -i -H "Authorization: Bearer <TOKEN>" \
  http://localhost:3001/v1/app/website/pageTypes | head -20

# 2. Tenant scope, no token — must stay 404
curl -s -o /dev/null -w '%{http_code}\n' \
  http://localhost:3001/v1/ecommerce/<sub>/website/pageTypes
```

Get the token by signing into the portal and copying the `Authorization` header
from any request (`POST /v1/app/login`). **Do not record this as verified on a
401 alone.**

### By design — NOT unfinished work

Three things will never show as "verified" and should not be read as gaps.

**`system` page type — no rows exist anywhere.** The backfill maps
`isStatic: true` to `system` only as a last resort, when nothing more specific
matched. On this database all six `isStatic` rows were identified by slug
(`checkout`, `menu`, `collections`, `shop`), so none needed the fallback. The
renderer is written and wired; there is simply no page anywhere to render with
it. It becomes verifiable the first time a merchant has a static page that no
slug rule recognises.

**`redirect` status — the storefront path has never fired.** The migration rule
IS proven: exercised against a real row inside a rolled-back transaction, where
`status` became `redirect`, `redirectTo` resolved to the company's catalog
listing, and the legacy key was preserved. But no row in the database has
`status = 'redirect'` (only 2 rows carry `redirect_to_shop` and both are
`false`), so `page-host`'s redirect branch has never executed against real data.
It becomes verifiable the first time a merchant sets one.

**`category-list` stays on the legacy endpoint — a boundary, not a gap.** There
is no unified categories endpoint, and none was planned: `getListing` unifies
PRODUCT listings, which is where the duplication was. The categories page calls
`shop/getCompanyCategories` and renders 173 tiles across 18 department groups
correctly. This changes only if someone decides categories need the same
treatment, which is a new piece of work rather than an unfinished one.

## What to pick up next

Priority order. Enough context to start without this conversation.

### 1. Document-templates unwrap migration — blocks other work

`feature/document-templates` holds five commits that were cherry-picked onto
`feature/new-project` and then reverted (`320983fa7`) because the work is
in progress. **The branch must stay alive until this is resolved.**

The blocker: `8adb00d26` edited migration
`1783700000000_Document_Templates_Render_Mode_Versions` **42 minutes after it
had already been applied**, removing the statement that WRAPPED each template as
`{"classic": {...}}` in favour of one flat blob. Because the migration was
already applied, the removal never executed and nothing unwrapped the existing
rows:

```text
DocumentTemplates: 17 rows
  16 WRAPPED   template = {"classic": {...}},  renderMode = 'classic'
   1 FLAT      renderMode = 'designer', real keys at top level
```

The flat-blob code reads those 16 rows with their content one level too deep.
Needs a NEW unwrap migration — the original is applied and immutable.

Also read the revert commit message: the two document-template migrations remain
APPLIED on the shared database, so a fresh database built from
`feature/new-project` will drift.

### 2. Five remaining `splice(-1)` sites — three are user-visible

`splice()` on an index that can be `-1` removes the LAST element instead of
nothing. Two instances were fixed (`Invoice.removeItem`, `option.socket.ts:443`);
these remain:

| Location | Effect |
| --- | --- |
| `src/utilts/ReportPDFGenerator.ts:705, 895, 1365` | a report without a barcode column silently loses its LAST column |
| `src/repo/socket/product.socket.ts:1221, 1225` | drops the last excluded option |
| `src/socket.ts:264` | `splice` sits outside the `if (terminalData)` guard — evicts an unrelated pending terminal |

The three `ReportPDFGenerator` ones are worth doing first: nobody reports a
column that was never there, so it reads as "that report doesn't include that
field" and can persist indefinitely.

### 3. `account` and `booking` — never run against real data

Both render, both were built from contracts read out of the backend source, and
neither has been exercised with real data.

- `account` — only the signed-out state has been seen. Needs a signed-in shopper
  with order history. Field mapping to check first: `orderHistory` returns a
  fixed column list with no item count, and the shopper's phone field is `phone`.
- `booking` — the branch dropdown was verified live (4 branches), but a
  reservation has never been submitted. `saveReservation` returns
  `{reservationSessionId}` only, and a signed-in shopper with an unvalidated
  phone is rejected with a message the form surfaces but that has never been
  seen rendered.

### 4. Checkout's excluded services

Checkout is **PickUp-only**. `Delivery`, `Shipping` and `DineIn` are listed in
`UNSUPPORTED_SERVICES` in `website/src/app/features/checkout/checkout.api.ts`
and hidden from the form, because each fails at the LAST step — after the
shopper has filled everything in:

- `DineIn` — `checkOut` throws "Table selection is required"; there is no table
  picker.
- `Delivery` / `Shipping` — need an address with geolocation matched against the
  branch's covered areas. **Every branch on the reference merchant has ZERO
  covered addresses**, so delivery could not complete there regardless.

Removing an entry from that constant is most of the work; the rest is the
address capture the two delivery modes need. Also unbuilt: the option/variant
picker, which is why products with required option groups show an explanation
instead of an Add button.

### 5. CI — nothing gates anything

See `InvoCloudBack/docs/tickets/no-ci-pipeline-exists.md`. Neither repo has any
CI config. `invo-portal2` defines `verify` (tests + i18n check) and the i18n gate
is currently RED — 142 untranslated `TODO_AR` placeholders — with nothing
observing it. Decision already taken: **i18n blocking on the default branch,
advisory elsewhere.** Platform left open — GitHub Actions for `invo-cloud21`,
CodeBuild for `InvoCloudBack`.

### Smaller, unsequenced

- **`hidden` status** — noindex and navigation exclusion are both built but have
  never run, because no page anywhere has `status = 'hidden'`. Set one to
  confirm.
- **SEO overrides** — `ShopRepo.getProduct` now attaches the row as `seo`; no
  product with an override has been fetched through the storefront yet.
- **Section `slot`** (top/bottom) is honoured by the storefront, no builder UI.
- **`primaryListingSlug`** is used by the renderers but not by navigation links
  or a home redirect.
- **Static pages in the builder** — open system pages in the builder with
  widgets/filters alongside their settings.
- Two external Website-Settings links (`settings/seo`, `settings/blog`) point at
  unverified routes.
