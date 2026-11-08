import { TestBed } from '@angular/core/testing';
import { HttpClient } from '@angular/common/http';
import { describe, expect, it } from 'vitest';

import { PrivilegeService } from './privilege.service';

/** A super admin is exempt from every privilege check, even against a tree that denies. */
const DENY_ALL = { invoiceSecurity: { access: false, actions: { add: { access: false } } } };

function service(): PrivilegeService {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({ providers: [{ provide: HttpClient, useValue: {} }] });
  return TestBed.inject(PrivilegeService);
}

describe('PrivilegeService — super admin bypass', () => {
  it('a normal user is still denied by an explicit false', () => {
    const s = service();
    s.setPrivileges(DENY_ALL);
    expect(s.check('invoiceSecurity.access')).toBe(false);
    expect(s.check('invoiceSecurity.actions.add')).toBe(false);
  });

  it('a super admin passes every check even when the tree denies', () => {
    const s = service();
    s.setPrivileges(DENY_ALL);
    s.setSuperAdmin(true);
    expect(s.check('invoiceSecurity.access')).toBe(true);
    expect(s.check('invoiceSecurity.actions.add')).toBe(true);
    expect(s.privileges).toBeNull(); // direct readers see "unrestricted" too
  });

  it('clearing the session removes the bypass', () => {
    const s = service();
    s.setSuperAdmin(true);
    s.clearPrivileges();
    s.setPrivileges(DENY_ALL);
    expect(s.check('invoiceSecurity.access')).toBe(false);
  });
});
