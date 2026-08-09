/**
 * Turning a failed HR request into something worth reading.
 *
 * ── WHY THIS EXISTS ──────────────────────────────────────────────────────────
 * None of the HR API has ever executed. The first upload is the first run of
 * the migration's trigger, the key generation, the child row and the audit; the
 * first asset save is the first run of the unique-tag check. The first failure
 * will almost certainly be something unglamorous: an unset bucket variable, a
 * route that was never registered, a multipart field name that does not match.
 *
 * A generic "Something went wrong" toast turns each of those into a debugging
 * session. This maps the failures that are actually likely onto messages that
 * name the cause, and falls back to showing the server's own words rather than
 * replacing them.
 *
 * ── THE HR API REFUSES WITH HTTP 200 ─────────────────────────────────────────
 * This is the trap. Every HR controller denies with
 * `res.send(new ResponseData(false, "Not permitted to …", null))` and the
 * global error handler turns a ValidationException into a 200 as well —
 * `statusCode = err.statusCode ?? 200`. So a missing grant, a bad asset tag and
 * a rejected date all arrive as *successful* HTTP responses whose body says
 * otherwise.
 *
 * The services therefore throw on `success === false`, and the message rules
 * below carry the weight the status rules would carry in a normal API. The 401
 * / 403 rules are kept because the auth middleware in front of the controllers
 * does use real statuses — but nothing inside HR reaches them.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Shared across every HR tab: the failure modes are properties of the API and
 * the deployment, not of documents or assets, and a second copy would drift
 * from this one on the first fix.
 */

export interface HrError {
  /** i18n key for the headline. */
  titleKey: string;
  /**
   * The server's own message, or a technical detail worth showing verbatim.
   * Deliberately not translated — it is diagnostic text, and translating it
   * would hide the string someone needs to search for.
   */
  detail: string | null;
  /** A concrete next step where one exists. */
  hintKey: string | null;
}

/** HTTP status, if the error came from HttpClient. */
function statusOf(error: any): number | null {
  const s = error?.status ?? error?.error?.status;
  return typeof s === 'number' ? s : null;
}

/** The server's message, from wherever the layers put it. */
function messageOf(error: any): string | null {
  const candidates = [
    error?.error?.msg,
    error?.error?.message,
    error?.msg,
    error?.message,
  ];
  const found = candidates.find(c => typeof c === 'string' && c.trim().length > 0);
  return found ? String(found).trim() : null;
}

export function describeError(error: any): HrError {
  const status = statusOf(error);
  const message = messageOf(error);

  // 404 on an HR endpoint almost always means the route is not registered on
  // the deployed backend — the HR work sits on a branch that may not be what
  // is running. Worth saying, because "not found" reads as "no such record".
  if (status === 404) {
    return {
      titleKey: 'EMPLOYEES.HR.ERR.NOT_DEPLOYED',
      detail: message,
      hintKey: 'EMPLOYEES.HR.ERR.NOT_DEPLOYED_HINT',
    };
  }

  if (status === 413) {
    return { titleKey: 'EMPLOYEES.HR.ERR.TOO_LARGE', detail: message, hintKey: null };
  }

  // The auth middleware in front of the controllers, not HR itself.
  if (status === 401 || status === 403) {
    return {
      titleKey: 'EMPLOYEES.HR.ERR.NOT_PERMITTED',
      detail: message,
      hintKey: 'EMPLOYEES.HR.ERR.NOT_PERMITTED_HINT',
    };
  }

  if (status === 0) {
    return { titleKey: 'EMPLOYEES.HR.ERR.UNREACHABLE', detail: message, hintKey: null };
  }

  if (message) {
    const lower = message.toLowerCase();

    // How HR actually refuses — a 200 whose body says no. Matched on the prefix
    // every controller shares ("Not permitted to view assets", "…to edit
    // documents", "…to decide appeals"), so one rule covers all of them.
    if (lower.startsWith('not permitted')) {
      return {
        titleKey: 'EMPLOYEES.HR.ERR.NOT_PERMITTED',
        detail: message,
        // Default-deny: the likely cause is a grant nobody has ticked.
        hintKey: 'EMPLOYEES.HR.ERR.NOT_PERMITTED_HINT',
      };
    }

    // The startup check should make this impossible, but if the expectation
    // flag is off the server degrades to a per-request failure instead.
    if (lower.includes('storage is not configured') || lower.includes('bucket')) {
      return {
        titleKey: 'EMPLOYEES.HR.ERR.NO_STORAGE',
        detail: message,
        hintKey: 'EMPLOYEES.HR.ERR.NO_STORAGE_HINT',
      };
    }

    // The server says this when `req.files` is empty — which on a first run
    // usually means the multipart field name or the middleware, not the file.
    if (lower.includes('file is required')) {
      return {
        titleKey: 'EMPLOYEES.HR.ERR.UPLOAD_REJECTED',
        detail: message,
        hintKey: 'EMPLOYEES.HR.ERR.UPLOAD_REJECTED_HINT',
      };
    }

    // Anything else the server chose to say is more useful than anything this
    // function could invent, so it is shown as-is. Asset-tag clashes land here
    // deliberately: "Asset tag is already assigned to Sara Ahmed" is the answer
    // the person entering it wants, and no rule here could improve on it.
    return { titleKey: 'EMPLOYEES.HR.ERR.FAILED', detail: message, hintKey: null };
  }

  return {
    titleKey: 'EMPLOYEES.HR.ERR.FAILED',
    detail: status ? `HTTP ${status}` : null,
    hintKey: null,
  };
}
