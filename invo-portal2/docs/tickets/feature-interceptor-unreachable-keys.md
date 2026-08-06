# `featureInterceptor` gates on six keys nothing can grant

**Area** `invo-portal2` — `core/interceptors/feature.interceptor.ts`,
registered app-wide in `app.config.ts`
**Severity** Inert today. A latent app-wide 403 for every tenant, triggered by
an ordinary change nobody would connect to it.
**Status** Written up, not fixed.

## What it does

```ts
const API_FEATURE_MAP: Record<string, AppFeature> = {
  '/invoices':              'sales.invoices',
  '/estimates':             'sales.estimates',
  '/payments':              'sales.payments',
  '/website-builder':       'website-builder',
  '/settings/billing':      'settings.billing',
  '/settings/integrations': 'settings.integrations',
};

const matchedFeature = Object.entries(API_FEATURE_MAP)
  .find(([path]) => req.url.includes(path))?.[1];
if (matchedFeature && !featureService.isEnabled(matchedFeature))
  return throwError(() => ({ status: 403, … }));
```

Any request whose URL *contains* one of those substrings is refused client-side
unless the company has the matching feature key.

## Why that is a landmine

**No company can have those keys.** The admin portal's Manage Features grid can
produce exactly: `account`, `inventory`, `ecommerce`, `notifications`,
`callcenter`, `hr`, and `promotions.*`. Production data confirms the same set.
None of the six exists, and there is no UI anywhere that could create one.

**It is inert only by accident.** Checked every endpoint string in the codebase
against all six patterns: **zero matches**. Real endpoints look like
`invoice/getInvoiceList`, `accounts/enablePaymentMethods` — singular, unslashed,
so `/invoices` and `/payments` never appear.

That is a coincidence of naming, not a design. The first endpoint added whose
URL contains `/payments` — a REST-ish `sales/payments`, say — starts returning
403 for **every tenant**, from an interceptor, with a message naming a feature
key that appears in no admin screen and no database row. Debugging that from the
symptom would take a long time.

Matching by `String.includes` on the whole URL makes it worse: a query string,
an id segment, or a differently-shaped base URL can all trip it.

## Also

`core/guards/feature.guard.ts` exists and is referenced by **no route**. Dead
code with the same assumption baked in.

## Options

- **Delete both.** Nothing uses the guard; the interceptor protects nothing that
  works. Least code, no behaviour change today, no landmine tomorrow.
- **Fix the keys and keep it.** Only worth doing if per-feature API gating is
  actually wanted — in which case the keys must come from the same shared list
  the admin grid writes, and the match should be on a parsed path segment rather
  than `includes`.
- **Leave it.** Cheapest now, and the failure mode is a mystery 403 for every
  merchant later.

Recommend deleting both, and re-adding gating deliberately if it is ever needed.
The version that exists cannot have been exercised: it would have failed on day
one for any tenant if a single URL had matched.

## Related

- `promotions-feature-key-mismatch.md` — the same class of defect, live.
- `EMPLOYEE_HR_FIELDS` carried `'EMPLOYEE_HR_FIELDS'` as its value until
  2026-08-06; the admin grid lowercases every key, so that flag could never have
  been switched on either. Fixed in `ad69e1d`.

Three instances of one root cause: **feature keys are strings agreed by
convention across two repositories, with nothing checking that the writer and
the reader mean the same thing.**
