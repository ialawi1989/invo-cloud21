# Invo Cloud — Portal + Storefront

Two Angular applications plus the shared page-type contract that keeps them in
agreement about what a page *is*.

| App | Port | What it is |
| --- | --- | --- |
| `invo-portal2/` | 4700 | The admin portal. Contains the page builder, page settings and website settings. |
| `website/` | 4600 | The public storefront. Angular SSR; also the live-preview target inside the builder. |
| `dashboard/` | — | **Legacy prototype. Not used, not started, safe to delete.** See below. |

The backend lives outside this repo at `D:\Projects\InvoCloudBack`.

## Architecture

```text
┌────────────────────────────────────────────────────────────────────┐
│  Portal — invo-portal2 (http://localhost:4700)                     │
│                                                                    │
│  /page-builder/:id/editor      ┌──────────────────────────────────┐│
│  ┌────────────────────┐        │ iframe → website :4600           ││
│  │ Control panel      │───────▶│                                  ││
│  │  · widget library  │        │  live preview of the page        ││
│  │  · page settings   │◀───────│  (postMessage bridge)            ││
│  └────────────────────┘        └──────────────────────────────────┘│
│                                                                    │
│  /website-settings   site-wide config (General / Commerce / …)     │
└────────────────────────────────────────────────────────────────────┘
                                │
                                ▼  shared contract
                   ┌──────────────────────────────┐
                   │  page-type manifest          │
                   │  GET /v1/app/pageTypes       │  (admin scope)
                   │  bundled fallback in both    │
                   └──────────────────────────────┘
```

### Page types

Every page row carries a `pageType`, which decides three things at once: which
widgets the builder offers, which settings the page exposes, and which renderer
the storefront mounts.

```text
content · product-list · product-detail · category-list
system  · cart · checkout · account · booking
```

The manifest is served to the **portal only** (`/v1/app/pageTypes`,
`Cache-Control: private`). The storefront never fetches it — it ships a bundled
fallback (`website/src/app/core/page-types/page-type.fallback.ts`), so a page
renders even if the admin API is unreachable.

When `pageType` is absent the type is inferred: `templateType` → slug →
`content`. That inference is why the backfill migration is optional rather than
a prerequisite.

### Storefront renderers

`website/src/app/features/`:

| Renderer | Status |
| --- | --- |
| `page-host` | Dispatches on `pageType`, renders saved sections around the core block |
| `product-list`, `product`, `category-list` | Working |
| `account`, `booking`, `cart` | Built; **response mappings unverified** against a live session |
| checkout | Not started — see the scoped plan in the project notes |

## Running

```bash
./start.sh          # macOS/Linux
start.bat           # Windows
```

Or individually — both bind `0.0.0.0`, so a phone on the same network can reach
them by LAN IP:

```bash
cd invo-portal2 && npm start     # :4700
cd website      && npm start     # :4600
```

## Verifying changes

Do **not** run `ng build` to check your work; it is slow and proves less than:

```bash
npx tsc --noEmit                            # types
npx ngc -p tsconfig.tplcheck.json           # templates, strict mode
```

## Legacy: `dashboard/`

A standalone customizer prototype that predates the portal. Its builder —
customizer shell, control panel, preview frame, theme manager, navigation
builder — was moved into `invo-portal2/src/app/features/website/page-builder/`
and rewired to real page data and the shared page-type manifest.

Nothing references it: not the start scripts, not either app's build. Removing
it is a one-liner and needs no other edit.

```bash
rm -rf dashboard
```
