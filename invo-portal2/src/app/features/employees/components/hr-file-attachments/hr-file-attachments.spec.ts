import { describe, expect, it } from 'vitest';

import { attachmentAccess } from './hr-file-attachments.component';

/**
 * Who gets an upload control, and who gets told why not.
 *
 * Tested as a pure function rather than through the rendered component: the
 * conditions only combine here, and a component test can pass because the
 * control was never reachable in the fixture — which is the trap
 * `employee-record.gating.spec.ts` records for the tab strip.
 *
 * Every case is paired with its inverse, because a gate that answers the same
 * thing unconditionally satisfies half of these and is not a gate.
 */

const ALL_OPEN = {
  isNew: false,
  featureEnabled: true,
  canView: true,
  canEdit: true,
  storageConfigured: true,
};

describe('attachmentAccess — the section is hidden entirely', () => {
  it('hides it when the company does not have the documents feature', () => {
    const access = attachmentAccess({ ...ALL_OPEN, featureEnabled: false });

    expect(access.visible).toBe(false);
    expect(access.canUpload).toBe(false);
  });

  it('hides it for a user with no view grant, even with the feature on', () => {
    // The HR API is default-deny: every request this user made would be
    // refused, so a control is worse than nothing.
    const access = attachmentAccess({ ...ALL_OPEN, canView: false });

    expect(access.visible).toBe(false);
    expect(access.canUpload).toBe(false);
  });

  it('SHOWS it when the feature and the view grant are both present', () => {
    // The inverse. A mutant returning `visible: false` unconditionally passes
    // both tests above and fails here.
    expect(attachmentAccess(ALL_OPEN).visible).toBe(true);
  });
});

describe('attachmentAccess — visible but not usable, with a reason', () => {
  it('disables upload for a NEW employee and says why', () => {
    // There is no record to attach to until the first save. Enabling it would
    // produce a control that fails on submit.
    const access = attachmentAccess({ ...ALL_OPEN, isNew: true });

    expect(access.visible).toBe(true);
    expect(access.canUpload).toBe(false);
    expect(access.reasonKey).toBe('EMPLOYEES.FILES.SAVE_EMPLOYEE_FIRST');
  });

  it('disables upload without an edit grant and says why', () => {
    const access = attachmentAccess({ ...ALL_OPEN, canEdit: false });

    expect(access.visible).toBe(true);
    expect(access.canUpload).toBe(false);
    expect(access.reasonKey).toBe('EMPLOYEES.FILES.NO_UPLOAD_PERMISSION');
  });

  it('disables upload when the server names no bucket', () => {
    const access = attachmentAccess({ ...ALL_OPEN, storageConfigured: false });

    expect(access.visible).toBe(true);
    expect(access.canUpload).toBe(false);
    expect(access.reasonKey).toBe('EMPLOYEES.FILES.STORAGE_UNCONFIGURED');
  });

  it('reports the NEW-employee reason first when both apply', () => {
    // A viewer creating an employee without an edit grant is told the thing
    // they can act on. Pinned because the order is a judgement, not an
    // accident, and reordering the branches would change it silently.
    const access = attachmentAccess({ ...ALL_OPEN, isNew: true, canEdit: false });

    expect(access.reasonKey).toBe('EMPLOYEES.FILES.SAVE_EMPLOYEE_FIRST');
  });
});

describe('attachmentAccess — fully usable', () => {
  it('allows upload when every condition is met', () => {
    // The inverse of all three disable cases: a mutant that always returns
    // `canUpload: false` satisfies them and fails here, having quietly removed
    // the feature.
    const access = attachmentAccess(ALL_OPEN);

    expect(access.visible).toBe(true);
    expect(access.canUpload).toBe(true);
  });

  it('gives no reason when there is nothing to explain', () => {
    // A mutant that always returns a reasonKey passes every disable test and
    // fails here — the user would see an explanation under a working control.
    expect(attachmentAccess(ALL_OPEN).reasonKey).toBeNull();
  });
});
