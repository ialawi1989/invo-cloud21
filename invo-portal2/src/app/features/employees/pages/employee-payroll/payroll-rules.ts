/**
 * Payroll access, and the two client-side validations worth doing.
 *
 * ── FOUR GRANTS, AND viewBank IS NOT IMPLIED BY viewPay ──────────────────────
 * The server splits them because the people who set salaries and the people who
 * run transfers are different people:
 *
 *   viewPay    salary, components, loans
 *   editPay    record a pay change, add a loan
 *   viewBank   IBAN, SWIFT, split accounts
 *   editBank   change the account a salary goes to
 *
 * Someone approving a rise has no business seeing the IBAN, and someone
 * reconciling a failed transfer has no business seeing the salary. So the tab
 * is two independently gated panels, not one screen behind one check.
 *
 * `editBank` is separate from `viewBank` for a different reason again: **the
 * payroll fraud is changing an account number, not reading one.**
 *
 * ── THE SUBJECT READS, AND WRITES NOTHING ────────────────────────────────────
 * `isSelf` admits an employee to their own pay and their own bank details on
 * the server, and to neither write path. `saveBankDetails` checks `editBank`
 * and never `isSelf` — nobody redirects their own salary without someone else's
 * involvement, which is the oldest control in payroll.
 * ─────────────────────────────────────────────────────────────────────────────
 */

export interface PayrollActor {
  actorEmployeeId: string | null;
  subjectEmployeeId: string;
  canViewPay: boolean;
  canEditPay: boolean;
  canViewBank: boolean;
  canEditBank: boolean;
}

export function isSubject(actor: PayrollActor): boolean {
  return !!actor.actorEmployeeId && actor.actorEmployeeId === actor.subjectEmployeeId;
}

/** May they see salary, components and loans? The grant, or their own record. */
export function mayViewPay(actor: PayrollActor): boolean {
  return actor.canViewPay || isSubject(actor);
}

/**
 * May they see the bank panel?
 *
 * `viewBank`, or their own. **Deliberately not `viewPay`** — the whole point of
 * the split is that seeing a salary confers nothing about seeing an account
 * number.
 */
export function mayViewBank(actor: PayrollActor): boolean {
  return actor.canViewBank || isSubject(actor);
}

/**
 * May they record a pay change?
 *
 * `editPay`, and NEVER the subject. Reading your own salary is reasonable;
 * setting it is not.
 */
export function mayEditPay(actor: PayrollActor): boolean {
  return actor.canEditPay && !isSubject(actor);
}

/**
 * May they change the bank details?
 *
 * `editBank`, and never the subject — the server refuses `isSelf` here outright.
 * Note this is asked independently of `mayViewBank`: holding `viewBank` alone
 * shows the panel read-only.
 */
export function mayEditBank(actor: PayrollActor): boolean {
  return actor.canEditBank && !isSubject(actor);
}

/** May they record a loan? Same grant as pay, same exclusion of the subject. */
export function mayEditLoans(actor: PayrollActor): boolean {
  return actor.canEditPay && !isSubject(actor);
}

// ─── IBAN ────────────────────────────────────────────────────────────────

/**
 * Country-specific IBAN lengths, copied from the server's table.
 *
 * Unknown countries are NOT rejected — the registry changes, and a stale table
 * here must not block a legitimate account. They pass on the checksum alone,
 * exactly as the server does.
 */
const IBAN_LENGTHS: Record<string, number> = {
  BH: 22, KW: 30, OM: 23, SA: 24, AE: 23, QA: 29, JO: 30, EG: 29,
  GB: 22, DE: 22, FR: 27, NL: 18, IE: 22, ES: 24, IT: 27, PT: 25,
};

/**
 * ISO 13616 mod-97 check.
 *
 * A copy of the server's implementation, and a deliberate one. The server's
 * answer is authoritative — this never overrides it — but a transposed
 * character caught before the request is worth far more than one caught after,
 * because the failure this guards against is a salary paid into the wrong
 * account, which takes weeks to recover.
 *
 * Chunked mod-97 rather than one parseInt: the rearranged number is far longer
 * than a safe integer, and a silent precision loss here would pass invalid
 * accounts — which is the one outcome worse than rejecting a valid one.
 */
export function isValidIban(raw: string | null | undefined): boolean {
  const iban = String(raw ?? '').replace(/[\s-]/g, '').toUpperCase();
  if (!/^[A-Z]{2}[0-9]{2}[A-Z0-9]{10,30}$/.test(iban)) return false;

  const expected = IBAN_LENGTHS[iban.slice(0, 2)];
  if (expected && iban.length !== expected) return false;

  const rearranged = iban.slice(4) + iban.slice(0, 4);
  const digits = rearranged.replace(/[A-Z]/g, ch => String(ch.charCodeAt(0) - 55));

  let remainder = 0;
  for (let i = 0; i < digits.length; i += 7) {
    remainder = Number(`${remainder}${digits.substr(i, 7)}`) % 97;
  }
  return remainder === 1;
}

/**
 * How an IBAN is shown once it has been changed.
 *
 * **The audit stores only the last four characters**, deliberately — enough to
 * prove an account was changed and to spot a change back, without a second copy
 * of everyone's bank details sitting in an audit table under different access
 * rules.
 *
 * So nothing in the UI that describes a CHANGE may show more than that. The
 * live value in the bank panel is a different matter: it is behind `viewBank`
 * and the person looking is entitled to it.
 */
export function maskIban(raw: string | null | undefined): string {
  const iban = String(raw ?? '').replace(/[\s-]/g, '').toUpperCase();
  if (!iban) return '';
  // Fewer than four characters is not a real IBAN; show nothing rather than
  // showing all of a short string.
  if (iban.length <= 4) return '••••';
  return `••••${iban.slice(-4)}`;
}

// ─── Split payments ──────────────────────────────────────────────────────

/**
 * Split accounts must total exactly 100%.
 *
 * Tolerant to 0.01, matching the server, so three-way splits at 33.33 are
 * accepted by both. An empty list is valid — it means no split.
 *
 * Anything else pays out either more or less than the salary, which is the one
 * arithmetic error payroll must never make. Checked here so a mistyped
 * percentage is caught before the request; the server's answer still decides.
 */
export function splitTotal(splits: { percentage?: number | null }[] | null | undefined): number {
  return (splits ?? []).reduce((sum, s) => sum + (Number(s?.percentage) || 0), 0);
}

export function splitsAreValid(splits: { percentage?: number | null }[] | null | undefined): boolean {
  const list = splits ?? [];
  if (list.length === 0) return true;
  return Math.abs(splitTotal(list) - 100) < 0.01;
}
