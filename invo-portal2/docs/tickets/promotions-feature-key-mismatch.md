# The `promotions` feature key: writer and reader disagree

**Area** `invo-portal2` — `core/layout/components/sidebar/quick-actions.component.ts:617`
· `invoAdminProtal` — `pages/manage-features/manage-features.component.ts`
**Severity** A feature silently disappears for a merchant nobody touched on
purpose. No error, no log.
**Status** Written up, not fixed. The fix needs a decision — see "Not
equivalent" below.

## The mismatch

The portal reads a **bare** key:

```ts
// quick-actions.component.ts:617
if (action.feature && !this.featureService.isEnabled(action.feature)) return false;
// …with  feature: 'promotions'
```

The admin portal's Manage Features grid writes **sub-keys only**. Its own
comment says so:

```ts
// There is no standalone "promotions" feature anymore — only these sub-features.
// The "Promotions" master toggle enables/disables all of them at once.
promotionFeatures = [
  { key: "promotions.stamp_cards", … }, { key: "promotions.coupons", … },
  { key: "promotions.customer_tiers", … }, { key: "promotions.points", … },
  { key: "promotions.vouchers", … },
];
```

`FeatureService.isEnabled()` is an exact `Set.has()`. `'promotions'` and
`'promotions.coupons'` are different strings, so a company whose features were
written by the new grid has every promotions sub-feature switched on and the
promotions quick action switched off.

## Which companies are affected — measure production before acting

From the dev database (`local2026`, 169 companies with a features array):

| Shape | Companies |
| --- | --- |
| bare `promotions` only | **167** |
| `promotions.*` sub-keys only | **1** |
| both | 0 |

So today the reader works for the overwhelming majority, and the one company
that has been through the new grid is the one that lost its quick action. Every
company re-saved in that grid from now on joins it.

**These are dev numbers.** Run the same split against production before choosing
a fix — the ratio decides how urgent this is and which option is safe.

```sql
SELECT
  count(*) FILTER (WHERE f ? 'promotions'
              AND NOT EXISTS (SELECT 1 FROM jsonb_array_elements_text(f) x WHERE x LIKE 'promotions.%')) AS bare_only,
  count(*) FILTER (WHERE NOT (f ? 'promotions')
              AND EXISTS (SELECT 1 FROM jsonb_array_elements_text(f) x WHERE x LIKE 'promotions.%')) AS subkeys_only,
  count(*) FILTER (WHERE f ? 'promotions'
              AND EXISTS (SELECT 1 FROM jsonb_array_elements_text(f) x WHERE x LIKE 'promotions.%')) AS both
FROM (SELECT "features"::jsonb f FROM "Companies" WHERE "features" IS NOT NULL) t;
```

## The two fixes are NOT equivalent

### A. Teach the consumers the sub-keys

Change `quick-actions` (and any future reader) to ask "does this company have
any `promotions.*` key?" rather than the bare string.

- **Correct model.** The grid's data shape becomes the truth, and the sub-keys
  are what the product actually sells.
- **But on its own it is a regression.** On the numbers above it would fix 1
  company and darken 167 — every company still carrying only the legacy bare
  key. A consumer-side change alone moves the outage, it doesn't end it.
- Safe only when paired with a data backfill that expands bare `promotions`
  into the five sub-keys.

### B. Keep writing the legacy key

Have the master toggle also write bare `promotions` whenever any sub-key is on.

- **Repairs affected companies automatically** — the next save through the grid
  restores the key, with no consumer change and no migration.
- Keeps 167 companies working exactly as they do now.
- **But it entrenches a duplicate representation**: the same fact in two shapes,
  which is what produced this bug. It is compatibility, not correctness.
- Note it only repairs a company when someone re-saves it; a backfill is still
  needed to fix the rest.

## Recommendation — both, in this order

1. **B first.** Master toggle writes bare `promotions` alongside the sub-keys.
   Smallest change, stops the bleeding, no consumer or data work.
2. **Backfill.** Expand bare `promotions` into the five sub-keys for every
   company that has the bare key and no sub-keys, so both shapes agree
   everywhere.
3. **Migrate consumers** to the sub-keys (option A) — `quick-actions` today,
   plus anything added since. With step 2 done, this is now safe.
4. **Drop the legacy write** from the grid, and the bare key from the data.

Steps 1–2 can ship together and are reversible. Do not do 3 before 2, or the
majority of merchants lose the feature.

## The general point

This is the second instance this week of the same failure: a feature key that a
writer and a reader spell differently, with no test between them. The first was
`EMPLOYEE_HR_FIELDS`, which carried an upper-case value the admin grid could
never store — the HR cards could not have been switched on by anyone. See
`feature-interceptor-unreachable-keys.md` for a third.

A cheap structural fix: one shared list of valid feature keys, exported from
somewhere both apps read, with a test asserting that every key a consumer checks
appears in it. Nothing today makes these two repos agree.
