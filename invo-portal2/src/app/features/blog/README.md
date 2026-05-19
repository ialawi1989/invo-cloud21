# Blog feature

Dashboard pages for managing blog posts, taxonomies (categories / tags /
hashtags), comments, and feature settings.

## File layout

```
features/blog/
├── blog.routes.ts                — lazy routes, mounted at /blog/*
├── README.md                     — this file
├── services/
│   ├── blog.types.ts             — Post / Taxonomy / Comment / Writer DTOs
│   ├── blog-settings.types.ts    — sectioned settings template + defaults
│   ├── blog-api.ts               — abstract BlogApi + BLOG_API token
│   ├── blog-mock-api.ts          — in-memory impl (seeded sample data)
│   ├── blog-http-api.ts          — real HTTP impl against blog/* endpoints
│   └── blog-api.providers.ts     — picks which impl BLOG_API resolves to
├── components/
│   ├── status-badge.component.ts        — color-coded status pill
│   ├── hashtag-text.component.ts        — turns "#word" into linked chips
│   ├── language-tabs.component.ts       — per-language tabs + completion
│   ├── slug-input.component.ts          — URL preview + uniqueness check
│   ├── rich-text-editor.component.ts    — contenteditable + hashtag picker
│   └── taxonomy-selector.component.ts   — multi-select chips for cats/tags
├── pages/
│   ├── posts-list/        — index page
│   ├── post-composer/     — new + edit form
│   ├── taxonomies/        — categories + tags + hashtags tabs
│   ├── comments/          — moderation list
│   └── blog-settings/     — feature settings (layout / display / RSS / SEO)
├── utils/blog-utils.ts    — slugify, extractHashtags, estimateReadingTime, …
└── i18n/{en,ar}.json      — feature-scoped translations
```

## API service

`BlogApi` ([services/blog-api.ts](./services/blog-api.ts)) is an abstract
class with every method the pages call. Two concrete impls live alongside it:

| Class           | When                                  | Behavior                              |
| --------------- | ------------------------------------- | ------------------------------------- |
| `BlogHttpApi`   | Default — real backend                | POSTs to `blog/*` on `environment.backendUrl` |
| `BlogMockApi`   | Local UI work without a backend       | In-memory data, ~300ms simulated latency |

The provider lives in [services/blog-api.providers.ts](./services/blog-api.providers.ts).
Swap impls by changing **one line**:

```ts
// real backend (default)
{ provide: BLOG_API, useExisting: BlogHttpApi }

// local mock for offline UI work
{ provide: BLOG_API, useExisting: BlogMockApi }
```

Pages inject `BLOG_API` (the token), never the concrete class.

### Endpoint contract

The HTTP impl uses the project's RPC-style convention (`POST /blog/<verb><Entity>`
with body, matching `accounts/getPaymentMethodList`, `company/saveWebsiteTheme`,
etc.). All responses are unwrapped from the `{ success, data }` envelope.

```
POST   blog/getPostList               { status?, language?, taxonomyId?, authorEmployeeId?, search?, page, limit, sortBy, sortDir }
                                      → { list, count, pageCount }
GET    blog/getPost/:id               → BlogPost
POST   blog/savePost                  (upsert — id field switches to update)
DELETE blog/deletePost/:id
POST   blog/publishPost               { id }
POST   blog/unpublishPost             { id }
POST   blog/schedulePost              { id, scheduledDate }
POST   blog/duplicatePost             { id }

POST   blog/getTaxonomyList           { taxonomyType, language?, search? } → BlogTaxonomy[]
GET    blog/getTaxonomy/:id           → BlogTaxonomy
POST   blog/saveTaxonomy              (upsert)
POST   blog/deleteTaxonomy            { id, reassignToId? }
POST   blog/reorderTaxonomies         [{ id, order }]
POST   blog/mergeTags                 { sourceId, targetId }
POST   blog/getPostsUsingHashtag      { id } → BlogPost[]

POST   blog/getCommentList            { postId?, status?, language?, search?, dateFrom?, dateTo?, page, limit }
                                      → { list, count, pageCount, statusCounts }
POST   blog/approveComment            { id }
POST   blog/flagComment               { id }
POST   blog/deleteComment             { id }
POST   blog/replyComment              { id, content }

GET    blog/getWriters                → BlogWriter[]
GET    blog/getSettings               → BlogSettingsRow
POST   blog/saveSettings              { id?, companyId?, template }

POST   blog/uploadImage               multipart/form-data field=file → { url }
```

If an endpoint isn't live yet, the call throws and the page renders its
error state (toast + retry button). Nothing on the UI side needs to
change once the endpoint comes online.

## Privileges

Routes are gated by `privilegeGuard` against the existing privilege tree
([core/auth/privileges/definitions/blogSecurity.ts](../../core/auth/privileges/definitions/blogSecurity.ts)):

| Route                  | Privilege path                              |
| ---------------------- | ------------------------------------------- |
| `/blog/posts`          | `blogSecurity.actions.view.access`          |
| `/blog/posts/new`      | `blogSecurity.actions.managePosts.access`   |
| `/blog/posts/:id/edit` | `blogSecurity.actions.managePosts.access`   |
| `/blog/categories`     | `blogSecurity.actions.manageCategories.access` |
| `/blog/comments`       | `blogSecurity.actions.moderateComments.access` |
| `/blog/settings`       | `blogSecurity.actions.manageSettings.access` |

The five sidebar entries (in `core/layout/components/sidebar/sidebar.component.ts`)
filter on the same paths via `canShow`, so employees who lack a privilege never
see the link. Within pages, the same privilege check hides action buttons:
e.g. the "+ New Post" button on Posts list shows only when
`blog.managePosts` is allowed.

The **backend** must return the privileges payload shaped to this tree —
`blogSecurity.actions.<view|managePosts|manageCategories|moderateComments|manageSettings>.access`.
If the API only emits the dot-notation codes (`blog.view`, `blog.manage_posts`),
the backend's privilege builder needs to map them onto this structure.

## Adding a new shared component

Drop a `*.component.ts` in [components/](./components/), keep template +
styles inline (matches the existing shared components). Then import +
declare it in whichever page uses it. No registry / barrel-file step.

Convention:
- Selector prefix `app-blog-*` to keep them grouped.
- Inputs via `input.required()` / `input(default)`, outputs via `output()`.
- `ChangeDetectionStrategy.OnPush` everywhere.
- Use `@core/i18n/with-translations` if the component needs i18n keys.

## Known TODOs / hand-off notes

- The HTTP impl assumes the backend implements the endpoint list above.
  None of them exist in the dev server today. Until they do, the mock
  impl is what makes the pages interactive; flip the provider once the
  backend ships.
- The post composer's preview link points at `/{lang}/blog/{slug}?preview=1`.
  That route lives on the public storefront (a different app), not in this
  dashboard repo — make sure the storefront honours the `preview=1` flag.
- Recent posts and views counters are read-only on the dashboard. The
  storefront is the one that should `POST blog/incrementViews/:id` when a
  reader opens a post; the field then surfaces here as `BlogPost.views`.
- `extractHashtags()` in `utils/blog-utils.ts` is shared by the composer
  (live preview) and should match the regex the backend uses when
  detecting hashtags during save. Keep both in sync.
