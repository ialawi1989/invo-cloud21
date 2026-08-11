# Setup Guide

How to get the portal, the storefront and the backend running together.

## Prerequisites

- **Node.js** v18+ — [download](https://nodejs.org/)
- **Angular CLI** v17+ — `npm install -g @angular/cli`
- The backend checkout at `D:\Projects\InvoCloudBack` (Express + Postgres)

## Quick start

```bash
./start.sh      # macOS/Linux
start.bat       # Windows
```

Installs missing dependencies and starts both apps. Or run them separately:

```bash
cd invo-portal2 && npm start     # portal     → http://localhost:4700
cd website      && npm start     # storefront → http://localhost:4600
```

Both bind `0.0.0.0`, so `http://<your-lan-ip>:4600` works from a phone on the
same network. If a device gets `ERR_CONNECTION_REFUSED`, the server was started
without `--host 0.0.0.0` — that is a flag problem, not an app problem.

The backend runs separately on `:3001`.

## Backend wiring

Four routers need mounting for the page-type work to answer:

| Router | Scope | Path |
| --- | --- | --- |
| `pageTypes.routes` | `/v1/app` (admin) | `src/modules/website/pageTypes/` |
| `siteConfigSchema` | `/v1/app` (admin) | `src/modules/website/siteConfig/` |
| `listing.routes` | tenant | `src/modules/website/listing/` |
| `siteConfig.routes` | tenant | `src/modules/website/siteConfig/` |

The manifest and the schema are **admin-scoped on purpose** — they describe the
authoring surface, not the storefront, and are served `Cache-Control: private`.
The storefront ships a bundled fallback and never fetches them.

### Migrations

Run in this order; the second assumes the first:

```bash
cd D:\Projects\InvoCloudBack
npm run migrate up
```

1. `1783800000000_website_page_type_backfill` — writes `pageType`/`source` into
   existing rows and adds two indexes.
2. `1783900000000_website_option_relocations` — copies relocated options to
   their new home.

Both are additive and idempotent. They **copy, never move**: the legacy key
stays where it was, and every reader falls back to it when the new key is
absent. That is what lets an unmigrated site keep behaving exactly as before —
running them is an optimisation, not a prerequisite, and rolling back breaks
nothing.

## Configuration

### Ports

Edit the `start` script in each app's `package.json`.

### Origins

The portal derives the storefront origin from the page host in development
(`website/src/environments/environment.ts` → `devDashboardOrigin()`), so LAN IPs
and `localhost` both work without editing a file. For production, set the
explicit origins in each app's `environment.prod.ts`.

## Verifying changes

```bash
npx tsc --noEmit                     # types
npx ngc -p tsconfig.tplcheck.json    # templates, strict mode
```

`ng build` is slower and proves less; skip it.

## Builder ↔ preview bridge

The builder loads the storefront in an iframe with `?customize=true`.

| Message | Direction | Meaning |
| --- | --- | --- |
| `preview-ready` | storefront → portal | iframe mounted |
| `page-data` | portal → storefront | full page document |
| `sync-all` | portal → storefront | all settings |
| `scroll-to-component` | portal → storefront | reveal a section |
| `reset` | portal → storefront | discard local changes |

## Troubleshooting

**Preview blank.** Check the console first. A 200 with an empty body usually
means a missing trailing slash on a path-prefixed URL, not a crash.

**`pageTypes` 404.** The router is not mounted — see *Backend wiring*.

**A page renders as the gap state.** Its `pageType` resolved to something with
no renderer. Checkout is the only remaining one; anything else means the
inference chain (`pageType` → `templateType` → slug → `content`) picked a value
you did not expect. Check `template.templateType` before assuming the slug.

**Settings changed in the portal do not show.** Confirm which key the storefront
reads. During the relocation window a value can exist under both the legacy and
the new key, and the new key wins.

## Legacy `dashboard/`

Unused prototype; its builder now lives in the portal. Nothing references it.

```bash
rm -rf dashboard
```

## Secrets guard (one command, do this on every clone)

```bash
git config core.hooksPath .githooks
```

Git does not install hooks from a repository automatically and there is no way
to make it — a fresh clone has the guard's *files* but not the guard. Until you
run that line, nothing is checking your commits.

It blocks two things: an env file in the index, and AWS/Sentry credential
patterns in staged content. The env check reads `git ls-files`, not the diff,
because the failure it exists to stop is a `.env` that entered the index years
ago and is re-committed silently on every branch — adding such a file to
`.gitignore` does nothing, since `.gitignore` only governs *untracked* paths.
That mistake has now been made in four of this product's repositories.

CI runs the same script over every tracked file
(`.github/workflows/secrets-guard.yml`), so a missing hook or `--no-verify`
does not get a change through.

If it blocks you, read the message — it prints the untrack-then-ignore sequence
and the `git ls-files --error-unmatch` check that proves the fix worked. The
allowlist `.secrets-guard-allow` is for pre-existing ticketed exposures only,
not for getting a commit through.

Run it by hand any time:

```bash
./scripts/check-secrets.sh --staged   # what the hook does
./scripts/check-secrets.sh --all      # what CI does
```
