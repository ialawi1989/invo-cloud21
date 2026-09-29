/**
 * Promotions feature flags — the single source of truth for the spellings.
 *
 * ── WHY THIS FILE EXISTS ─────────────────────────────────────────────────────
 * This is the third instance of the same defect, and the fix for the previous
 * two was a comment. A feature key is a string agreed by convention across two
 * repositories — this app and `invoAdminProtal` — with nothing checking that the
 * writer and the reader spell it the same way. When they disagree the feature
 * silently disappears for a merchant nobody touched on purpose: no error, no
 * log, just a tile that isn't there.
 *
 *   1. `EMPLOYEE_HR_FIELDS` carried an upper-case value the admin grid could
 *      never store. Fixed in ad69e1d — see `hr-feature-subkeys.ts`.
 *   2. This app read the bare key `'promotions'`; the admin grid had stopped
 *      writing it. See `docs/tickets/promotions-feature-key-mismatch.md`.
 *   3. The `featureInterceptor` gates on six keys no company can be granted.
 *      See `docs/tickets/feature-interceptor-unreachable-keys.md`.
 *
 * So: one exported list, imported by every consumer, rather than a literal
 * typed at each call site. A typo is now a compile error, not a vanished tile.
 *
 * ── THE KEYS, AND WHERE THEY COME FROM ────────────────────────────────────────
 * The admin portal's Manage Features grid can produce exactly:
 * `account`, `inventory`, `ecommerce`, `notifications`, `callcenter`, `hr`, and
 * the five `promotions.*` sub-keys below. Nothing else — no bare `promotions`,
 * no upper-case variants. That grid lowercases every key on the way in and out.
 *
 * The legacy InvoCloudFront2 panel gated these same five features on
 * UPPERCASE keys (`PROMOTIONS.COUPONS`, `PROMOTIONS.POINTS`, …). Those spellings
 * are the bug this file exists to stop repeating: the grid cannot store them, so
 * every one of them was unswitchable, exactly like `EMPLOYEE_HR_FIELDS` was.
 * Do not port a key across from the old project without lowercasing it here.
 *
 * ── ⚠ DO NOT GATE NEW UI ON THESE YET ─────────────────────────────────────────
 * Per `docs/tickets/promotions-feature-key-mismatch.md`, measured on dev:
 *
 *     bare `promotions` only      167 companies
 *     `promotions.*` sub-keys only  1 company
 *     both                          0
 *
 * A consumer that checks `promotions.coupons` is therefore **invisible for 167 of
 * 168 companies** — the writer/reader mismatch, re-created at a larger scale.
 * That ticket's ordering is explicit: the data backfill (expand bare
 * `promotions` into the five sub-keys) must land BEFORE consumers migrate. Doing
 * it in the other order "moves the outage, it doesn't end it".
 *
 * That is why `promotion` tiles are gated on privilege only for now, and why
 * the vouchers route is deliberately un-plan-gated. Re-run the split query in
 * that ticket against PRODUCTION before changing any of it — the dev ratio is
 * what makes the backfill look cheap, and it is not evidence about prod.
 *
 * The moment the backfill has run and `both` / `subkeys_only` is 100%, gate on
 * the constants here and delete this warning.
 */

/** Stamp cards. Legacy `PROMOTIONS.STAMP_CARDS`. */
export const PROMOTIONS_STAMP_CARDS = 'promotions.stamp_cards';
/** Coupon booklets. Legacy `PROMOTIONS.COUPONS`. */
export const PROMOTIONS_COUPONS = 'promotions.coupons';
/** Customer tiers and their benefits. Legacy `PROMOTIONS.CUSTOMER_TIERS`. */
export const PROMOTIONS_CUSTOMER_TIERS = 'promotions.customer_tiers';
/** Loyalty points earning/spending. Legacy `PROMOTIONS.POINTS`. */
export const PROMOTIONS_POINTS = 'promotions.points';
/** Gift vouchers. Legacy `PROMOTIONS.VOUCHERS`. */
export const PROMOTIONS_VOUCHERS = 'promotions.vouchers';

/** Every promotions key the admin grid can write. */
export const PROMOTIONS_FEATURE_KEYS = [
  PROMOTIONS_STAMP_CARDS,
  PROMOTIONS_COUPONS,
  PROMOTIONS_CUSTOMER_TIERS,
  PROMOTIONS_POINTS,
  PROMOTIONS_VOUCHERS,
] as const;

/**
 * What a campaign can actually run on. Customer Tiers and Vouchers are
 * deliberately absent: neither alone gives a company anything to campaign with,
 * so Campaigns stays hidden for a plan holding only those. Mirrors
 * `CAMPAIGNS_FEATURES` in the legacy project, which was kept in step with the
 * `systemFeature` arrays in `_campaigns.privileges.ts`.
 *
 * Kept in step with the privileges definition when that is ported.
 */
export const CAMPAIGNS_FEATURE_KEYS = [
  PROMOTIONS_STAMP_CARDS,
  PROMOTIONS_POINTS,
  PROMOTIONS_COUPONS,
] as const;
