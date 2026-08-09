import { AssetStatusDescriptor } from '../../services/employee-asset.service';

/**
 * Whether the chosen status may carry a return date and an inbound condition.
 *
 * ── THE RULE LIVES ON THE SERVER; THIS ONLY READS IT ─────────────────────────
 * `employeeAsset.repo.validate` refuses on two flags from the status catalogue:
 *
 *   expectsReturn === true   → a return date AND an inbound condition are
 *                              required. The item came back and someone looked
 *                              at it. (Returned, Damaged)
 *   expectsReturn === false  → neither may be set. Recording the condition of a
 *                              laptop nobody ever saw again is a fiction, and
 *                              this is exactly the case where someone would
 *                              tick "Good" to clear the form. (Lost, WrittenOff,
 *                              and Assigned, which has not come back yet)
 *
 * **Do not hardcode which statuses fall where.** Two copies of that mapping
 * drift the moment a status is added, and the server's copy is the one that
 * refuses — the portal's would either demand a field the server rejects or omit
 * one it requires, and the screen gives no clue which.
 * ─────────────────────────────────────────────────────────────────────────────
 */
export type ReturnFieldsMode = 'required' | 'forbidden' | 'unknown';

/**
 * @param statusKey the selected status, or null before one is chosen
 * @param statuses  the server's catalogue, which may be empty if it failed to load
 *
 * `unknown` is returned when the catalogue has nothing to say — an empty
 * catalogue or a status not in it. That is deliberately NOT treated as
 * `forbidden`: a portal that cannot read the rule must not invent one. It stops
 * enforcing, lets the request through, and lets the server give the real
 * answer, which is worse UX and better behaviour than a confident guess.
 */
export function returnFieldsMode(
  statusKey: string | null | undefined,
  statuses: AssetStatusDescriptor[],
): ReturnFieldsMode {
  if (!statusKey || !statuses?.length) return 'unknown';
  const descriptor = statuses.find(s => s.key === statusKey);
  if (!descriptor || typeof descriptor.expectsReturn !== 'boolean') return 'unknown';
  return descriptor.expectsReturn ? 'required' : 'forbidden';
}

/** Does this status leave the item in the employee's hands? */
export function isOpenStatus(
  statusKey: string | null | undefined,
  statuses: AssetStatusDescriptor[],
): boolean | null {
  if (!statusKey || !statuses?.length) return null;
  const descriptor = statuses.find(s => s.key === statusKey);
  if (!descriptor || typeof descriptor.closesAssignment !== 'boolean') return null;
  return !descriptor.closesAssignment;
}
