# `hr` became `hr.profile` + `hr.documents` — the portal still asks for `hr`

**Status** Portal side DONE. The change described below is implemented.
**Reconciled** 2026-08-17 — see the two corrections below.

> ## CORRECTED 2026-08-17 — two claims in the body have expired
>
> Verified against `invo-portal2 @ storefront-preview-ssr-routing bcde083` and
> `invoAdminProtal` (branch `feature/addfeatures-to-company`).
>
> **1. "TWO keys" is now NINE.** `[read]` `hr.profile`, `hr.documents`,
> `hr.assets`, `hr.leave`, `hr.performance`, `hr.disciplinary`, `hr.payroll`,
> `hr.benefits`, `hr.eos` — one per module, none riding on another. The "change
> needed here" section below describes the first two only; it was completed and
> then extended.
>
> **2. "`hr` is enabled for no company" is FALSE.** `[executed]` Measured on
> dev across 175 companies:
>
> ```
> hr          bare-only 0    both 1   sub-keys-only 2
> promotions  bare-only 167  both 0   sub-keys-only 1
> ```
>
> The promotions row reproduces the figures this ticket itself cites, which is
> the control that makes the `hr` row trustworthy rather than just a number.
>
> **The decision does not change, because the count was never the real reason.**
> Bare `hr` is INERT BUT PERMANENT: no screen writes it — `toggleGroup` touches
> only the sub-keys and `id: 'hr'` is a heading — but
> `companies-form.component.ts` (`normalizeFeatures`) loads the stored array and
> saves it back verbatim, so a legacy value survives every save while never
> being newly created.
>
> That is why the portal must never accept bare `hr` as a fallback: it would
> retroactively give a dead value meaning for whichever companies still carry
> it, with no way to tell which of them ever meant it. Unlike "enabled for no
> company", that reason does not expire — which is the whole lesson of this
> reconciliation pass.
>
> The failure this guards against — a company on bare `hr` ONLY, every HR tab
> dark with no visible cause — has **zero instances**.
**Admin side** Done — `invoAdminProtal` commit `7e93ffa`.
**Portal side** Done — `HR_PROFILE` / `HR_DOCUMENTS`, no bare-`hr` fallback,
`hrFieldsEnabled()` on `hr.profile`, new `hrDocumentsEnabled()` on
`hr.documents`, dev override now `ff.hr.profile` / `ff.hr.documents`.

Kept as the record of why the split was done before the portal caught up, and of
the promotions precedent that made a fallback the wrong answer. The remaining
value here is §"Verification once both sides ship", which nobody has run — no
company has HR enabled.

---

## What changed

The admin portal's feature catalogue no longer has a bare `hr` key. It is now a
group of two sub-features, written together by one master toggle:

| Key | Covers |
| --- | --- |
| `hr.profile` | Personal-details and employment-details cards on the employee form (phase 1) |
| `hr.documents` | Documents tab — passports, visas, licences, expiry tracking, reminders (phase 2) |

A group's **sub-keys are what get stored**. The master toggle writes them all
and stores nothing of its own, so **the string `hr` is never written to
`Companies.features` again**.

## What the portal does today

`src/app/features/employees/employee-feature-flags.ts`:

```ts
export const EMPLOYEE_HR_FIELDS = 'hr';
```

`FeatureService.isEnabled()` matches exactly, so this asks for a key nothing
writes any more. Switch HR on for a merchant and the cards stay hidden, with no
error anywhere — the toggle is decorative.

## Why this was done before the portal caught up

Because the alternative is strictly worse, and we already have the evidence.

The same split was done to promotions after companies were live on the bare key.
The result is on the books and still unfixed: **167 companies hold bare
`promotions`, 1 holds sub-keys**, and the portal gates its promotions quick
action on the string the admin screen stopped writing. Fixing it now means
either a backfill or teaching the portal both spellings, and doing it wrong
darkens the feature for 167 merchants.

`hr` is enabled for **no company**. There is nothing to migrate and no window in
which the two spellings disagree. Doing it after documents shipped would have
recreated the promotions situation exactly, on data a merchant notices vanishing.

## The change needed here

**1. Replace the single constant with the two keys.**

```ts
export const HR_PROFILE    = 'hr.profile';
export const HR_DOCUMENTS  = 'hr.documents';
```

Keep `EMPLOYEE_HR_FIELDS` as a deprecated alias of `HR_PROFILE` if call sites
are widespread, but do not leave it pointing at `'hr'`.

**2. `hrFieldsEnabled()` gates on `hr.profile`.** It guards the Personal /
Employment cards, which is exactly what `hr.profile` means. One-line change.

**3. Add `hrDocumentsEnabled()` for the documents tab**, gating on
`hr.documents`. New, and only needed when the tab is built.

**4. Update the dev override.** `localStorage.setItem('ff.hr','1')` currently
keys off the flag string, so it becomes `ff.hr.profile` / `ff.hr.documents`.
Worth checking nobody's QA notes still say `ff.hr`.

**5. Do NOT add a fallback that also accepts bare `hr`.** Tempting, and it is
what makes the promotions mismatch hard to resolve — two spellings both
"working" means nobody can tell which is authoritative, and the dead one never
gets removed. There is no legacy data to be compatible with here.

## Verification once both sides ship

1. Tick **HR** (master) in the admin portal for a test company, save.
2. Confirm `Companies.features` contains `hr.profile` and `hr.documents`, and
   **not** `hr`.
3. The merchant user signs out and back in — features hydrate at login, a
   refresh is not enough.
4. Personal / Employment cards render.
5. Untick **Documents** only, save, sign out and in: the cards stay, the
   documents tab goes. That is the whole reason for splitting, so it is worth
   testing explicitly rather than assuming.

## Related

- `docs/tickets/promotions-feature-key-mismatch.md` — the same defect, live.
- `docs/tickets/feature-interceptor-unreachable-keys.md` — six more keys the
  interceptor gates on that nothing writes.
- `InvoCloudBack/docs/runbooks/employee-hr-phase1-enablement.md` — enablement
  steps; its §2 says to tick "HR", which is still correct, but the verification
  in §3 should check the two sub-keys once this lands.
