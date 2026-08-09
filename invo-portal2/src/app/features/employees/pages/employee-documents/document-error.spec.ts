import { describe, expect, it } from 'vitest';

import { describeError } from './document-error';
import { portalKey } from './document-labels';

/**
 * The error mapper.
 *
 * ── WHY THIS IS WORTH TESTING ────────────────────────────────────────────────
 * The file layer has never executed against a database or a bucket. This
 * mapper is the only thing standing between the first failure and a generic
 * toast, so the cases it claims to name have to actually be named — a mapper
 * that silently falls through to "The request failed" is the same as not having
 * one, and the fallthrough is invisible.
 * ─────────────────────────────────────────────────────────────────────────────
 */
describe('describeError', () => {
  it('calls a 404 a deployment problem, not a missing document', () => {
    // "Not found" reads as "no such document" and sends someone looking in the
    // wrong place. The HR routes live on a branch; 404 usually means they are
    // not on this environment.
    const e = describeError({ status: 404 });
    expect(e.titleKey).toBe('EMPLOYEES.DOCUMENTS.ERR.NOT_DEPLOYED');
    expect(e.hintKey).toBe('EMPLOYEES.DOCUMENTS.ERR.NOT_DEPLOYED_HINT');
  });

  it('points a 403 at the grant rather than at a bug', () => {
    // HR is default-deny server-side, so the overwhelmingly likely cause is a
    // permission nobody ticked.
    const e = describeError({ status: 403 });
    expect(e.titleKey).toBe('EMPLOYEES.DOCUMENTS.ERR.NOT_PERMITTED');
    expect(e.hintKey).toBe('EMPLOYEES.DOCUMENTS.ERR.NOT_PERMITTED_HINT');
  });

  it('names an unset bucket from the server message', () => {
    const e = describeError({ error: { msg: 'Document storage is not configured' } });
    expect(e.titleKey).toBe('EMPLOYEES.DOCUMENTS.ERR.NO_STORAGE');
  });

  it('reads "file is required" as the transport, not the file', () => {
    // The server says this when req.files is empty. On a first run that is the
    // multipart field name or the middleware — sending the user back to pick a
    // different file would waste their time entirely.
    const e = describeError({ error: { msg: 'A file is required' } });
    expect(e.titleKey).toBe('EMPLOYEES.DOCUMENTS.ERR.UPLOAD_REJECTED');
    expect(e.hintKey).toBe('EMPLOYEES.DOCUMENTS.ERR.UPLOAD_REJECTED_HINT');
  });

  it('shows the server’s own words verbatim when it has no rule for them', () => {
    // Untranslated on purpose: this is the string someone will search for.
    const e = describeError({ error: { msg: 'duplicate key value violates unique constraint' } });
    expect(e.titleKey).toBe('EMPLOYEES.DOCUMENTS.ERR.FAILED');
    expect(e.detail).toBe('duplicate key value violates unique constraint');
  });

  it('still says something useful when there is no message at all', () => {
    expect(describeError({ status: 500 }).detail).toBe('HTTP 500');
    expect(describeError(undefined).titleKey).toBe('EMPLOYEES.DOCUMENTS.ERR.FAILED');
  });

  it('prefers a status rule over a message rule', () => {
    // A 404 whose body happens to mention a bucket is still a 404.
    const e = describeError({ status: 404, error: { msg: 'bucket' } });
    expect(e.titleKey).toBe('EMPLOYEES.DOCUMENTS.ERR.NOT_DEPLOYED');
  });
});

/**
 * The server sends `employees.documents.type.nationalId`; this feature's
 * translations are `EMPLOYEES.DOCUMENTS.TYPE.NATIONAL_ID`. If the mapping is
 * wrong the type column renders raw dotted keys — visible, but only to whoever
 * looks at the screen.
 */
describe('portalKey', () => {
  it('maps the server’s label keys onto the portal’s namespace', () => {
    expect(portalKey('employees.documents.type.nationalId'))
      .toBe('EMPLOYEES.DOCUMENTS.TYPE.NATIONAL_ID');
    expect(portalKey('employees.documents.type.passport'))
      .toBe('EMPLOYEES.DOCUMENTS.TYPE.PASSPORT');
    expect(portalKey('employees.documents.type.drivingLicence'))
      .toBe('EMPLOYEES.DOCUMENTS.TYPE.DRIVING_LICENCE');
  });
});
