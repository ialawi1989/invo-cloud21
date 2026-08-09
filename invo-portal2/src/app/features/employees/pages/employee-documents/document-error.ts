/**
 * Turning a failed HR request into something worth reading.
 *
 * ── WHY THIS EXISTS ──────────────────────────────────────────────────────────
 * The file layer has never executed. The first upload anyone performs is the
 * first run of the migration's trigger, the key generation, the child row and
 * the audit — and the first failure will almost certainly be something
 * unglamorous: an unset bucket variable, a route that was never registered, a
 * multipart field name that does not match.
 *
 * A generic "Something went wrong" toast turns each of those into a debugging
 * session. This maps the failures that are actually likely onto messages that
 * name the cause, and falls back to showing the server's own words rather than
 * replacing them.
 * ─────────────────────────────────────────────────────────────────────────────
 */

export interface DocumentError {
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

export function describeError(error: any): DocumentError {
  const status = statusOf(error);
  const message = messageOf(error);

  // 404 on an HR endpoint almost always means the route is not registered on
  // the deployed backend — the HR work sits on a branch that may not be what
  // is running. Worth saying, because "not found" reads as "no such document".
  if (status === 404) {
    return {
      titleKey: 'EMPLOYEES.DOCUMENTS.ERR.NOT_DEPLOYED',
      detail: message,
      hintKey: 'EMPLOYEES.DOCUMENTS.ERR.NOT_DEPLOYED_HINT',
    };
  }

  if (status === 413) {
    return {
      titleKey: 'EMPLOYEES.DOCUMENTS.ERR.TOO_LARGE',
      detail: message,
      hintKey: null,
    };
  }

  if (status === 401 || status === 403) {
    return {
      titleKey: 'EMPLOYEES.DOCUMENTS.ERR.NOT_PERMITTED',
      detail: message,
      // Default-deny: the likely cause is a grant nobody has ticked, not a bug.
      hintKey: 'EMPLOYEES.DOCUMENTS.ERR.NOT_PERMITTED_HINT',
    };
  }

  if (status === 0) {
    return {
      titleKey: 'EMPLOYEES.DOCUMENTS.ERR.UNREACHABLE',
      detail: message,
      hintKey: null,
    };
  }

  if (message) {
    const lower = message.toLowerCase();

    // The startup check should make this impossible, but if HR_DOCUMENTS_EXPECTED
    // is false the server degrades to a per-request failure instead.
    if (lower.includes('storage is not configured') || lower.includes('bucket')) {
      return {
        titleKey: 'EMPLOYEES.DOCUMENTS.ERR.NO_STORAGE',
        detail: message,
        hintKey: 'EMPLOYEES.DOCUMENTS.ERR.NO_STORAGE_HINT',
      };
    }

    // The server says this when `req.files` is empty — which on a first run
    // usually means the multipart field name or the middleware, not the file.
    if (lower.includes('file is required')) {
      return {
        titleKey: 'EMPLOYEES.DOCUMENTS.ERR.UPLOAD_REJECTED',
        detail: message,
        hintKey: 'EMPLOYEES.DOCUMENTS.ERR.UPLOAD_REJECTED_HINT',
      };
    }

    // Anything else the server chose to say is more useful than anything this
    // function could invent, so it is shown as-is.
    return { titleKey: 'EMPLOYEES.DOCUMENTS.ERR.FAILED', detail: message, hintKey: null };
  }

  return {
    titleKey: 'EMPLOYEES.DOCUMENTS.ERR.FAILED',
    detail: status ? `HTTP ${status}` : null,
    hintKey: null,
  };
}
