# driver.js's stylesheet is imported nowhere — the report-builder tour is broken

**Area** `src/styles.scss` / `angular.json` · consumer:
`src/app/features/reports/custom/services/report-tour.service.ts`
**Severity** Visible breakage in a shipped feature, but only while its tour runs.
**Status** Written up, not fixed. Deliberately left out of the employees guided-tour
change — see "Why this wasn't fixed there".

## What's missing

`driver.js` is a dependency and the custom-report builder drives a full
eleven-step walkthrough with it, but **`driver.js/dist/driver.css` is not
imported anywhere**: not in `angular.json`'s `styles` array, not in
`src/styles.scss`, not in any component stylesheet. Confirmed by search across
the repo.

## Why that's worse than "unstyled"

The vendor stylesheet is not only cosmetic. Three of its rules are structural,
and without them a tour doesn't work properly at all:

| Rule | Consequence when missing |
| --- | --- |
| `.driver-popover { position: fixed }` | The popover is laid out in the normal document flow instead of being positioned against the highlighted element. driver.js sets `left`/`top` inline, but they do nothing on a statically-positioned element. |
| `.driver-popover { z-index: 1000000000 }` | The popover can render *behind* page content and the overlay. |
| `.driver-active * { pointer-events: none }` plus the `auto` exceptions for `.driver-popover` and `.driver-active-element` | Nothing gates interaction, so the page stays fully clickable underneath the overlay — the "spotlight" is decorative only. |

So the report-builder tour has most likely never behaved as intended for anyone.
Nobody has reported it, which is itself worth noting: either the tour is rarely
opened, or people who opened it assumed it was meant to look like that.

## Fix

Add one line to `angular.json`'s `styles` array (or `src/styles.scss`):

```json
"node_modules/driver.js/dist/driver.css"
```

**This will visibly change the report-builder tour** — from a broken popover to a
styled, correctly-positioned one. That is an improvement, but it is a change to a
shipped feature and someone should look at it deliberately: open the report
builder, run the tour end to end, and check it against the eleven steps in
`report-builder.component.ts`.

Consider pairing it with a migration of `ReportTourService` onto the shared
`GuidedTourService` (`src/app/shared/services/guided-tour.service.ts`), which
would bring the reports tour i18n and RTL support at the same time. The two
wrappers are near-duplicates today.

## Why this wasn't fixed alongside the employees tour

Importing the vendor stylesheet globally would have altered how the reports tour
looks and behaves, inside a pull request about the employee form. Nobody
reviewing that PR would expect it, and nobody debugging a reports change later
would think to look there.

The employees tour therefore ships its own styles in
`src/styles/_guided-tour.scss`, reproducing the structural rules under selectors
scoped to `.driver-popover.app-guided-tour` and `html.app-guided-tour-active` —
so it can't affect any other driver.js consumer. Once this ticket lands, that
file can be slimmed down to just the theming.
