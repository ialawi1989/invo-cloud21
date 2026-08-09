import { describe, expect, it } from 'vitest';

import { describeError } from './hr-error';
import { portalKey } from './hr-labels';

/**
 * The error mapper.
 *
 * ── WHY THIS IS WORTH TESTING ────────────────────────────────────────────────
 * The HR API has never executed against a database or a bucket. This mapper is
 * the only thing standing between the first failure and a generic toast, so the
 * cases it claims to name have to actually be named — a mapper that silently
 * falls through to "The request failed" is the same as not having one, and the
 * fallthrough is invisible.
 * ─────────────────────────────────────────────────────────────────────────────
 */
describe('describeError', () => {
  it('calls a 404 a deployment problem, not a missing record', () => {
    // "Not found" reads as "no such document" and sends someone looking in the
    // wrong place. The HR routes live on a branch; 404 usually means they are
    // not on this environment.
    const e = describeError({ status: 404 });
    expect(e.titleKey).toBe('EMPLOYEES.HR.ERR.NOT_DEPLOYED');
    expect(e.hintKey).toBe('EMPLOYEES.HR.ERR.NOT_DEPLOYED_HINT');
  });

  /**
   * The one that matters most, and the one commit 3 got wrong.
   *
   * Every HR controller refuses with `res.send(new ResponseData(false, "Not
   * permitted to …", null))` — HTTP 200 with a body that says no. A mapper that
   * only handled 403 would send every missing grant to the generic fallback,
   * which is precisely the case where naming the cause saves an hour.
   */
  it('recognises a refusal that arrives as a successful HTTP 200', () => {
    const e = describeError({ message: 'Not permitted to view assets' });
    expect(e.titleKey).toBe('EMPLOYEES.HR.ERR.NOT_PERMITTED');
    expect(e.hintKey).toBe('EMPLOYEES.HR.ERR.NOT_PERMITTED_HINT');
  });

  it('covers every controller’s wording with the one prefix rule', () => {
    // Copied verbatim from the controllers, so a reworded refusal that no
    // longer starts this way shows up here rather than in production.
    const refusals = [
      'Not permitted to view documents',
      'Not permitted to edit assets',
      'Not permitted to verify documents',
      'Not permitted to decide appeals',
      'Not permitted to attach files here',
      'Not permitted to view leave',
    ];
    for (const msg of refusals) {
      expect(describeError({ message: msg }).titleKey).toBe('EMPLOYEES.HR.ERR.NOT_PERMITTED');
    }
  });

  it('still handles a real 403 from the auth middleware', () => {
    // The middleware in front of the controllers does use real statuses.
    const e = describeError({ status: 403 });
    expect(e.titleKey).toBe('EMPLOYEES.HR.ERR.NOT_PERMITTED');
  });

  it('names an unset bucket from the server message', () => {
    const e = describeError({ error: { msg: 'Document storage is not configured' } });
    expect(e.titleKey).toBe('EMPLOYEES.HR.ERR.NO_STORAGE');
  });

  it('reads "file is required" as the transport, not the file', () => {
    // The server says this when req.files is empty. On a first run that is the
    // multipart field name or the middleware — sending the user back to pick a
    // different file would waste their time entirely.
    const e = describeError({ error: { msg: 'A file is required' } });
    expect(e.titleKey).toBe('EMPLOYEES.HR.ERR.UPLOAD_REJECTED');
    expect(e.hintKey).toBe('EMPLOYEES.HR.ERR.UPLOAD_REJECTED_HINT');
  });

  it('shows an asset-tag clash exactly as the server worded it', () => {
    // The server's message names who currently holds the tag, which is the
    // question the person entering it actually has. No rule here could improve
    // on it, so it falls through to verbatim on purpose.
    const e = describeError({ message: 'Asset tag is already assigned to Sara Ahmed' });
    expect(e.titleKey).toBe('EMPLOYEES.HR.ERR.FAILED');
    expect(e.detail).toBe('Asset tag is already assigned to Sara Ahmed');
  });

  it('shows the server’s own words verbatim when it has no rule for them', () => {
    // Untranslated on purpose: this is the string someone will search for.
    const e = describeError({ error: { msg: 'duplicate key value violates unique constraint' } });
    expect(e.titleKey).toBe('EMPLOYEES.HR.ERR.FAILED');
    expect(e.detail).toBe('duplicate key value violates unique constraint');
  });

  it('still says something useful when there is no message at all', () => {
    expect(describeError({ status: 500 }).detail).toBe('HTTP 500');
    expect(describeError(undefined).titleKey).toBe('EMPLOYEES.HR.ERR.FAILED');
  });

  it('prefers a status rule over a message rule', () => {
    // A 404 whose body happens to mention a bucket is still a 404.
    const e = describeError({ status: 404, error: { msg: 'bucket' } });
    expect(e.titleKey).toBe('EMPLOYEES.HR.ERR.NOT_DEPLOYED');
  });
});

/**
 * The server sends `employees.assets.category.idCard`; this feature's
 * translations are `EMPLOYEES.ASSETS.CATEGORY.ID_CARD`. If the mapping is wrong
 * the labels render as raw dotted keys — visible, but only to whoever looks at
 * the screen.
 */
describe('portalKey', () => {
  it('maps the server’s label keys onto the portal’s namespace', () => {
    expect(portalKey('employees.documents.type.nationalId'))
      .toBe('EMPLOYEES.DOCUMENTS.TYPE.NATIONAL_ID');
    expect(portalKey('employees.documents.type.drivingLicence'))
      .toBe('EMPLOYEES.DOCUMENTS.TYPE.DRIVING_LICENCE');
    expect(portalKey('employees.assets.category.idCard'))
      .toBe('EMPLOYEES.ASSETS.CATEGORY.ID_CARD');
    expect(portalKey('employees.assets.status.writtenOff'))
      .toBe('EMPLOYEES.ASSETS.STATUS.WRITTEN_OFF');
  });
});
