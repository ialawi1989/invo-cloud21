import moment from "moment";

/**
 * Shared SQL fragments AND a JS `nextOccurrence` helper used by
 * RecurringBills / RecurringExpenses / RecurringInvoices / RecurringJournals.
 *
 * The SQL piece (`recurringDueWhere`) is used by the cron job to find
 * which recurring records are "due" on a given date ($1::date).
 *
 * The JS piece (`nextOccurrence`) is used by the *Overview endpoints to
 * compute the human-facing "next bill/expense/invoice/journal date".
 * Both code paths share the same semantics so the UI cannot disagree
 * with what the cron will actually generate.
 *
 * Fixes vs. the original copy-pasted version:
 *  - Monthly: also fires on the last day of the month when the configured
 *    "on" day does not exist that month (e.g. on=31 in February).
 *  - Monthly/Yearly: month/year diff is computed in *absolute* units
 *    (year * 12 + month, year) so multi-period schedules no longer break
 *    across year boundaries due to Postgres truncated-mod on negatives.
 *  - Weekly: week diff is computed from the first fire date forward,
 *    avoiding the original cross-month/cross-year off-by-one.
 *  - NULLIF on periodQty avoids divide-by-zero on bad data.
 *  - Idempotency: a recurring is excluded from a given run if a child
 *    record (linked via the FK column) was already created today, so a
 *    second cron pass / manual retrigger / restart on the same day cannot
 *    create a duplicate. See `recurringDueWhere(...)` below.
 *
 * The fragment expects:
 *   - $1 to be a timestamp/date (today)
 *   - the table to expose "startDate", "endDate", "endTerm", "repeatData"
 */

/**
 * Returns the WHERE clause used to find recurring records that are due
 * to fire on $1::date. Pass the child table + FK column so the same
 * fragment can be reused for Bills / Expenses / Invoices / Journals.
 *
 * The NOT EXISTS clause prevents creating a second linked child for the
 * same recurring on the same calendar day. It does NOT detect duplicates
 * if the user creates a child outside the recurring flow (no FK link),
 * because there is no way to correlate such a record with a recurring
 * period without false positives.
 */
export function recurringDueWhere(opts: {
    /** quoted recurring table name, e.g. `"RecurringBills"` */
    recurringTable: string;
    /** quoted child table name, e.g. `"Billings"` */
    childTable: string;
    /** quoted FK column on the child table, e.g. `"recurringBillId"` */
    childFkColumn: string;
}): string {
    const { recurringTable, childTable, childFkColumn } = opts;
    return `
        ${RECURRING_DUE_WHERE}
        AND NOT EXISTS (
            SELECT 1 FROM ${childTable} _dup
            WHERE _dup.${childFkColumn} = ${recurringTable}.id
              AND _dup."createdAt"::date = ($1::date)
        )
    `;
}

// ---------------------------------------------------------------------------
// Bounded-parallelism worker pool used by the four generateAuto* functions.
// Processes `items` with at most `concurrency` workers in flight at once.
// A worker that throws does NOT abort the others — failures are caller's
// responsibility (each generateAuto* worker logs + swallows internally).
// ---------------------------------------------------------------------------
export const RECURRING_AUTO_CONCURRENCY = 3;

export async function runWithConcurrency<T>(
    items: T[],
    concurrency: number,
    worker: (item: T, index: number) => Promise<void>,
): Promise<void> {
    if (items.length === 0) return;
    const effective = Math.max(1, Math.min(concurrency, items.length));
    let next = 0;
    const runners = Array.from({ length: effective }, async () => {
        while (true) {
            const i = next++;
            if (i >= items.length) return;
            try {
                await worker(items[i], i);
            } catch (err) {
                // Defensive: workers are expected to handle their own errors,
                // but we never let an unhandled rejection take down the pool.
                console.log("runWithConcurrency: unhandled worker error", err);
            }
        }
    });
    await Promise.all(runners);
}

// ---------------------------------------------------------------------------
// JS helper: compute the next occurrence of a recurring schedule.
//
// Returns the smallest occurrence date that is *strictly after* `asOf`.
// Mirrors the semantics of `recurringDueWhere` so the UI display and the
// cron-side SQL agree.
//
// Bug-for-bug fixes vs the previous getNext*Date implementations:
//  - Monthly: clamps `on` to the last day of the month when it does not
//    exist there (e.g. on=31 in February → Feb 28/29).
//  - Yearly: months are 0-indexed in moment, so `set('month', on - 1)` is
//    used unconditionally; the previous `on != 1 ? on - 1 : 12` was
//    overflowing January into the next year.
//  - Yearly: month comparison now compares 1-indexed to 1-indexed.
//  - Weekly: uses `.day(on)` (locale-independent, 0=Sunday) to match the
//    SQL `extract(dow from ...)` rather than locale-dependent `weekday`.
//  - Future-start + periodQty>1 no longer returns a date earlier than the
//    first occurrence (the old modulo math could go negative).
// ---------------------------------------------------------------------------

function clampDayToMonth(m: moment.Moment, day: number): moment.Moment {
    const out = m.clone().startOf('month');
    return out.date(Math.min(day, out.daysInMonth()));
}

function monthlyFirstFire(start: moment.Moment, on: number): moment.Moment {
    // Candidate = the `on`-th day of `start`'s month, clamped if needed.
    let candidate = clampDayToMonth(start, on);
    if (start.isAfter(candidate, 'day')) {
        // We've already passed this month's fire day -> next month.
        candidate = clampDayToMonth(start.clone().add(1, 'month'), on);
    }
    return candidate;
}

function monthlyNext(start: moment.Moment, on: number, periodQty: number, asOf: moment.Moment): moment.Moment {
    const first = monthlyFirstFire(start, on);
    if (first.isAfter(asOf, 'day')) return first;

    // Estimate how many full periods to jump forward, then walk to the
    // next strictly-future occurrence (handles day-clamping edge cases).
    const monthsApart = (asOf.year() - first.year()) * 12 + (asOf.month() - first.month());
    const jumps = Math.max(0, Math.floor(monthsApart / periodQty));

    let candidate = clampDayToMonth(first.clone().add(jumps * periodQty, 'month'), on);
    let safety = 0;
    while (!candidate.isAfter(asOf, 'day') && safety++ < 24) {
        candidate = clampDayToMonth(candidate.clone().add(periodQty, 'month'), on);
    }
    return candidate;
}

function weeklyFirstFire(start: moment.Moment, on: number): moment.Moment {
    // 0 = Sunday .. 6 = Saturday (matches SQL extract(dow ...))
    const startDow = start.day();
    const offset = startDow <= on ? on - startDow : 7 - (startDow - on);
    return start.clone().add(offset, 'days').startOf('day');
}

function weeklyNext(start: moment.Moment, on: number, periodQty: number, asOf: moment.Moment): moment.Moment {
    const first = weeklyFirstFire(start, on);
    if (first.isAfter(asOf, 'day')) return first;

    const daysApart = asOf.clone().startOf('day').diff(first.clone().startOf('day'), 'days');
    const weeksApart = Math.max(0, Math.floor(daysApart / 7));
    const jumps = Math.floor(weeksApart / periodQty);

    let candidate = first.clone().add(jumps * periodQty, 'weeks');
    let safety = 0;
    while (!candidate.isAfter(asOf, 'day') && safety++ < 24) {
        candidate = candidate.clone().add(periodQty, 'weeks');
    }
    return candidate;
}

function yearlyFirstFire(start: moment.Moment, on: number): moment.Moment {
    // `on` is the target month, 1..12. Always fires on day 1 of that month
    // (matches the SQL: `extract(day from $1)::int = 1`).
    let candidate = start.clone().startOf('year').add(on - 1, 'months').startOf('month');
    if (start.isAfter(candidate, 'day')) {
        candidate = candidate.clone().add(1, 'year');
    }
    return candidate;
}

function yearlyNext(start: moment.Moment, on: number, periodQty: number, asOf: moment.Moment): moment.Moment {
    const first = yearlyFirstFire(start, on);
    if (first.isAfter(asOf, 'day')) return first;

    const yearsApart = asOf.year() - first.year();
    const jumps = Math.max(0, Math.floor(yearsApart / periodQty));

    let candidate = first.clone().add(jumps * periodQty, 'years');
    let safety = 0;
    while (!candidate.isAfter(asOf, 'day') && safety++ < 24) {
        candidate = candidate.clone().add(periodQty, 'years');
    }
    return candidate;
}

/**
 * Compute the next occurrence of a recurring schedule.
 *
 * @returns a moment in the future (strictly after `asOf`), or `null` if
 *          the inputs are invalid / periodicity is unsupported.
 */
export function nextOccurrence(
    startDate: moment.Moment | Date | string,
    repeatData: { on: any; periodQty: any; periodicity: any },
    asOf?: moment.Moment | Date,
): moment.Moment | null {
    const start = moment(startDate);
    const now = asOf ? moment(asOf) : moment();
    if (!start.isValid() || !now.isValid()) return null;
    if (!repeatData) return null;

    const on = Number(repeatData.on);
    const periodQty = Number(repeatData.periodQty);
    if (!Number.isFinite(on) || !Number.isFinite(periodQty) || periodQty < 1) return null;

    switch (repeatData.periodicity) {
        case 'Monthly': return monthlyNext(start, on, periodQty, now);
        case 'Weekly':  return weeklyNext(start, on, periodQty, now);
        case 'Yearly':  return yearlyNext(start, on, periodQty, now);
        default:        return null;
    }
}

export const RECURRING_DUE_WHERE = `
    "startDate"::date <= ($1::date)
    AND ( "endTerm" = 'none' OR ("endTerm" = 'by' AND "endDate"::date >= ($1::date)) )
    AND (
        -- ============================ Monthly ============================
        (
            "repeatData"->>'periodicity' = 'Monthly'
            AND (
                extract(day from ($1::date))::int = (("repeatData"->>'on')::int)
                OR (
                    -- "on" day does not exist in current month -> fire on last day
                    (("repeatData"->>'on')::int) > extract(day from (date_trunc('month', $1::date) + INTERVAL '1 month - 1 day'))::int
                    AND ($1::date) = (date_trunc('month', $1::date) + INTERVAL '1 month - 1 day')::date
                )
            )
            AND (
                (
                    (extract(year from ($1::date))::int * 12 + extract(month from ($1::date))::int)
                    - (extract(year from "startDate")::int * 12 + extract(month from "startDate")::int)
                    - (CASE WHEN extract(day from "startDate")::int <= (("repeatData"->>'on')::int) THEN 0 ELSE 1 END)
                ) >= 0
                AND (
                    (
                        (extract(year from ($1::date))::int * 12 + extract(month from ($1::date))::int)
                        - (extract(year from "startDate")::int * 12 + extract(month from "startDate")::int)
                        - (CASE WHEN extract(day from "startDate")::int <= (("repeatData"->>'on')::int) THEN 0 ELSE 1 END)
                    ) % NULLIF((("repeatData"->>'periodQty')::int), 0) = 0
                )
            )
        )

        -- ============================ Weekly =============================
        OR (
            "repeatData"->>'periodicity' = 'Weekly'
            AND extract(dow from ($1::date))::int = (("repeatData"->>'on')::int)
            AND (
                (($1::date) - (
                    "startDate"::date + (
                        CASE
                            WHEN extract(dow from "startDate")::int <= (("repeatData"->>'on')::int)
                                THEN ((("repeatData"->>'on')::int) - extract(dow from "startDate")::int)
                            ELSE (7 - (extract(dow from "startDate")::int - (("repeatData"->>'on')::int)))
                        END
                    )
                )) >= 0
            )
            AND (
                (
                    (($1::date) - (
                        "startDate"::date + (
                            CASE
                                WHEN extract(dow from "startDate")::int <= (("repeatData"->>'on')::int)
                                    THEN ((("repeatData"->>'on')::int) - extract(dow from "startDate")::int)
                                ELSE (7 - (extract(dow from "startDate")::int - (("repeatData"->>'on')::int)))
                            END
                        )
                    )) / 7
                ) % NULLIF((("repeatData"->>'periodQty')::int), 0) = 0
            )
        )

        -- ============================ Yearly =============================
        OR (
            "repeatData"->>'periodicity' = 'Yearly'
            AND extract(month from ($1::date))::int = (("repeatData"->>'on')::int)
            AND extract(day from ($1::date))::int = 1
            AND (
                (
                    extract(year from ($1::date))::int
                    - extract(year from "startDate")::int
                    - (CASE
                        WHEN extract(month from "startDate")::int < (("repeatData"->>'on')::int)
                             OR (extract(month from "startDate")::int = (("repeatData"->>'on')::int) AND extract(day from "startDate")::int = 1)
                          THEN 0
                        ELSE 1
                      END)
                ) >= 0
                AND (
                    (
                        extract(year from ($1::date))::int
                        - extract(year from "startDate")::int
                        - (CASE
                            WHEN extract(month from "startDate")::int < (("repeatData"->>'on')::int)
                                 OR (extract(month from "startDate")::int = (("repeatData"->>'on')::int) AND extract(day from "startDate")::int = 1)
                              THEN 0
                            ELSE 1
                          END)
                    ) % NULLIF((("repeatData"->>'periodQty')::int), 0) = 0
                )
            )
        )
    )
`;
