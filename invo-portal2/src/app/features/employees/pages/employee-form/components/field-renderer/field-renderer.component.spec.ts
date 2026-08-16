import { TestBed } from '@angular/core/testing';
import { FormBuilder, FormArray, FormGroup } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { beforeEach, describe, expect, it } from 'vitest';

import { FieldDescriptor } from '../../../../models/field-manifest.types';
import { buildGroupControl } from '../../../../services/manifest-form.util';
import { FieldRendererComponent } from './field-renderer.component';

const FIELDS: FieldDescriptor[] = [
  { key: 'department', type: 'text', labelKey: 'DEPT', suggestionSource: 'departments' },
  { key: 'employmentType', type: 'select', labelKey: 'TYPE', options: [{ value: 'Contract', labelKey: 'C' }] },
  { key: 'isDepartmentHead', type: 'boolean', labelKey: 'HEAD' },
  { key: 'seniorityDate', type: 'date', labelKey: 'SEN' },
  { key: 'probationEndDate', type: 'computed', labelKey: 'PROB_END' },
  {
    key: 'contractEndDate',
    type: 'date',
    labelKey: 'END',
    visibleWhen: "employment.employmentType == 'Contract'",
  },
  {
    key: 'address',
    type: 'group',
    labelKey: 'ADDR',
    fields: [{ key: 'city', type: 'text', labelKey: 'CITY' }],
  },
  {
    key: 'contacts',
    type: 'group[]',
    labelKey: 'CONTACTS',
    fields: [{ key: 'name', type: 'text', labelKey: 'NAME', required: true }],
  },
];

/** Mounts the renderer over a manifest-built group, as the employee form does. */
function mount(values: Record<string, any> = {}) {
  const group = buildGroupControl(TestBed.inject(FormBuilder), FIELDS);
  const fixture = TestBed.createComponent(FieldRendererComponent);
  fixture.componentRef.setInput('descriptors', FIELDS);
  fixture.componentRef.setInput('group', group);
  fixture.componentRef.setInput('path', 'employment');
  fixture.componentRef.setInput('values', values);
  fixture.componentRef.setInput('suggestionSources', { departments: ['Finance', 'IT'] });
  fixture.componentRef.setInput('computedValues', { 'employment.probationEndDate': '2026-09-01' });
  fixture.detectChanges();
  return { fixture, group };
}

describe('field-renderer', () => {
  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [FieldRendererComponent, TranslateModule.forRoot()],
    });
  });

  it('renders each descriptor onto a shared control, never a native select', () => {
    const { fixture } = mount();
    const host: HTMLElement = fixture.nativeElement;

    expect(host.querySelector('input[type="text"]')).toBeTruthy();
    expect(host.querySelector('app-search-dropdown')).toBeTruthy();
    expect(host.querySelector('app-toggle')).toBeTruthy();
    expect(host.querySelector('app-date-picker')).toBeTruthy();
    expect(host.querySelector('select')).toBeNull();
  });

  it('binds a typed value straight into the form group', () => {
    const { fixture, group } = mount();
    const input: HTMLInputElement = fixture.nativeElement.querySelector('input[type="text"]');
    input.value = 'Finance';
    input.dispatchEvent(new Event('input'));
    expect(group.get('department')!.value).toBe('Finance');
  });

  it('honours visibleWhen', () => {
    expect(mount().fixture.nativeElement.querySelectorAll('app-date-picker').length).toBe(1);
    const visible = mount({ employment: { employmentType: 'Contract' } });
    expect(visible.fixture.nativeElement.querySelectorAll('app-date-picker').length).toBe(2);
  });

  it('renders a nested group and offers free-text suggestions', () => {
    const host: HTMLElement = mount().fixture.nativeElement;
    // A nested group renders as a labelled band, not a <fieldset>. Asserting
    // the group renders AND that no fieldset comes back, so the plain-band
    // decision is pinned rather than just the class name being swapped.
    expect(host.querySelector('.fr-group')).toBeTruthy();
    expect(host.querySelector('.fr-group__title')?.textContent?.trim()).toBeTruthy();
    expect(host.querySelector('fieldset')).toBeNull();
    expect(host.querySelectorAll('datalist option').length).toBe(2);
  });

  it('shows a computed value read-only, with no control behind it', () => {
    const { fixture, group } = mount();
    expect(fixture.nativeElement.querySelector('.fr-computed').textContent.trim()).toBe('2026-09-01');
    expect(group.get('probationEndDate')).toBeNull();
  });

  it('adds and removes repeatable rows', () => {
    const { fixture, group } = mount();
    const rows = () => (group.get('contacts') as FormArray);

    expect(fixture.nativeElement.querySelector('.fr-repeat__empty')).toBeTruthy();

    (fixture.nativeElement.querySelector('.fr-repeat__head .btn') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(rows().length).toBe(1);
    expect((rows().at(0) as FormGroup).get('name')!.hasError('required')).toBe(true);

    (fixture.nativeElement.querySelector('.fr-row__head .btn') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(rows().length).toBe(0);
  });
});

describe('field-renderer — the Education certificate hint', () => {
  /**
   * Education gets NO file attachment, deliberately: it is jsonb inside the
   * employee record, and the file layer attaches to rows in registered
   * entities. The hint points at Documents -> `Qualification`, which is the
   * better home anyway — it gains expiry tracking and verification.
   */
  function component() {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [FieldRendererComponent, TranslateModule.forRoot()],
    });
    return TestBed.createComponent(FieldRendererComponent).componentInstance;
  }

  it('offers the Documents pointer on the education group', () => {
    const c = component();

    expect(c.extraHintKey({ key: 'education', type: 'group[]', labelKey: 'EDU' } as FieldDescriptor))
      .toBe('EMPLOYEES.FORM.EDUCATION_CERTIFICATE_HINT');
  });

  it('offers nothing on any other group', () => {
    // The inverse. A mutant returning the key unconditionally satisfies the
    // test above and puts a note about qualification certificates under
    // emergency contacts and dependants.
    const c = component();

    expect(c.extraHintKey({ key: 'dependents', type: 'group[]', labelKey: 'DEP' } as FieldDescriptor)).toBeNull();
    expect(c.extraHintKey({ key: 'emergencyContacts', type: 'group[]', labelKey: 'EC' } as FieldDescriptor)).toBeNull();
  });

  it("defers to the manifest's own hint when the server supplies one", () => {
    // A server-side hint must win rather than render two paragraphs. Mutant:
    // drop the `if (d.hintKey) return null` guard — it compiles, runs, and
    // reddens here only.
    const c = component();

    expect(c.extraHintKey({
      key: 'education', type: 'group[]', labelKey: 'EDU', hintKey: 'SERVER.HINT',
    } as FieldDescriptor)).toBeNull();
  });
});
