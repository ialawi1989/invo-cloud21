import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { describe, expect, it, vi } from 'vitest';

import { LanguageService } from '@core/i18n/language.service';
import { PrivilegeService } from '@core/auth/privileges/privilege.service';
import { EmployeePrivilege } from '@core/auth/privileges/models/privilege.model';
import { ToastService } from '@shared/components/toast/toast.service';
import { ModalService } from '@shared/modal/modal.service';

import { PrivilegeFormComponent } from './privilege-form.component';

/**
 * The system-role lock is decided by the server-set `systemKey` and by nothing
 * else — least of all the editable name, which is what the DevTools bypass
 * played with.
 */

function role(over: Partial<EmployeePrivilege> & { systemKey?: string | null }): EmployeePrivilege {
  const ep = new EmployeePrivilege();
  ep.id = 'r1';
  ep.name = 'Cashier';
  Object.assign(ep, over);
  return ep;
}

async function open(ep: EmployeePrivilege, savePrivilege: any = vi.fn().mockResolvedValue({ success: true })) {
  const toast = { success: vi.fn(), error: vi.fn() };
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    imports: [PrivilegeFormComponent, TranslateModule.forRoot()],
    providers: [
      {
        provide: PrivilegeService,
        useValue: {
          getPrivilege: vi.fn().mockResolvedValue(ep),
          getPrivilegeList: vi.fn().mockResolvedValue({ list: [] }),
          savePrivilege,
        },
      },
      { provide: LanguageService, useValue: { loadFeature: vi.fn() } },
      { provide: ToastService, useValue: toast },
      { provide: ModalService, useValue: { open: vi.fn() } },
      { provide: Router, useValue: { navigate: vi.fn() } },
      { provide: ActivatedRoute, useValue: { snapshot: { paramMap: new Map([['id', 'r1']]) } } },
    ],
  });
  const fixture = TestBed.createComponent(PrivilegeFormComponent);
  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();
  return { fixture, component: fixture.componentInstance, toast, savePrivilege };
}

describe('privilege-form — system roles', () => {
  it.each(['SUPER_ADMIN', 'OWNER'])('is fully readonly when systemKey is %s, whatever the name', async (systemKey) => {
    const { component, fixture } = await open(role({ name: 'Totally Ordinary', systemKey }));
    expect(component.lockedRole()).toBe(true);
    const root: HTMLElement = fixture.nativeElement;
    expect((root.querySelector('input[type="text"]') as HTMLInputElement).readOnly).toBe(true);
    const save = Array.from(root.querySelectorAll('button')).find(b => b.classList.contains('btn-primary')) as HTMLButtonElement;
    expect(save.disabled).toBe(true);
  });

  it('forces every permission on for a system role (display only)', async () => {
    const { component } = await open(role({ name: 'X', systemKey: 'SUPER_ADMIN' }));
    const tree: any = (component as any).record().privileges;
    const sections = Object.keys(tree).filter(k => typeof tree[k]?.ToJson === 'function');
    expect(sections.length).toBeGreaterThan(0);
    expect(sections.every(k => tree[k].access === true)).toBe(true);
  });

  it.each(['Super Admin', 'Owner', ' super admin '])('does NOT lock a normal role named %j', async (name) => {
    const { component, fixture } = await open(role({ name, systemKey: null }));
    expect(component.lockedRole()).toBe(false);
    const root: HTMLElement = fixture.nativeElement;
    expect((root.querySelector('input[type="text"]') as HTMLInputElement).readOnly).toBe(false);
    // …and it is not force-enabled either: a name must never trigger forceAllOn.
    const tree: any = (component as any).record().privileges;
    const sections = Object.keys(tree).filter(k => typeof tree[k]?.ToJson === 'function');
    expect(sections.some(k => tree[k].access !== true)).toBe(true);
  });

  it('a locked form never calls save', async () => {
    const { component, savePrivilege } = await open(role({ systemKey: 'OWNER' }));
    await component.save();
    expect(savePrivilege).not.toHaveBeenCalled();
  });

  it('never sends systemKey back to the server', () => {
    expect(role({ systemKey: 'SUPER_ADMIN' }).ToJson()).not.toHaveProperty('systemKey');
  });

  it('shows the translated system-role message on a 403', async () => {
    const save = vi.fn().mockRejectedValue({ status: 403, message: 'System role cannot be modified' });
    const { component, toast } = await open(role({ systemKey: null }), save);
    await component.save();
    expect(toast.error).toHaveBeenCalledWith('EMPLOYEES.PRIVILEGES.SYSTEM_ROLE_LOCKED');
  });
});
