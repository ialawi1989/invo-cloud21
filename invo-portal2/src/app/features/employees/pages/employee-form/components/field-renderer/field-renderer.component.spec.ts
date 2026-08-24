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
    fields: [
      { key: 'name', type: 'text', labelKey: 'NAME', required: true },
      { key: 'isPrimary', type: 'boolean', labelKey: 'PRIMARY', exclusiveInGroup: true },
      // A NON-exclusive boolean beside it, so the tests can show the handler
      // touches only what it was told to.
      { key: 'isArchived', type: 'boolean', labelKey: 'ARCHIVED' },
    ],
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


describe('field-renderer — an exclusive flag across repeated rows', () => {
  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [FieldRendererComponent, TranslateModule.forRoot()],
    });
  });

  /** Three contact rows, so "the others" is plural and an off-by-one shows. */
  function threeRows() {
    const { fixture, group } = mount();
    const c = fixture.componentInstance;
    const desc = FIELDS.find((f) => f.key === 'contacts')!;
    c.addRow(group, desc);
    c.addRow(group, desc);
    c.addRow(group, desc);
    const rows = c.rows(group, 'contacts');
    return { c, rows, primary: desc.fields!.find((f) => f.key === 'isPrimary')! };
  }

  it('turning one ON turns the others OFF', () => {
    const { c, rows, primary } = threeRows();
    rows[0].get('isPrimary')!.setValue(true);

    rows[2].get('isPrimary')!.setValue(true);
    c.onExclusiveToggle(primary, rows[2], true);

    expect(rows[0].get('isPrimary')!.value).toBe(false);
    expect(rows[1].get('isPrimary')!.value).toBe(false);
    expect(rows[2].get('isPrimary')!.value).toBe(true);
  });

  it('turning one OFF leaves the others alone', () => {
    // "No primary" is a state the user may pass through while re-choosing. The
    // server catches it on save if they stop there; the form must not fight
    // them mid-edit.
    const { c, rows, primary } = threeRows();
    rows[1].get('isPrimary')!.setValue(true);

    rows[1].get('isPrimary')!.setValue(false);
    c.onExclusiveToggle(primary, rows[1], false);

    expect(rows.map((r) => r.get('isPrimary')!.value)).toEqual([false, false, false]);
  });

  it('does NOT touch a boolean that is not exclusive', () => {
    // The inverse that stops this being "clear every sibling boolean". Without
    // it, a handler ignoring the flag entirely would pass every case above.
    const { c, rows } = threeRows();
    const archived = FIELDS.find((f) => f.key === 'contacts')!
      .fields!.find((f) => f.key === 'isArchived')!;

    rows[0].get('isArchived')!.setValue(true);
    rows[1].get('isArchived')!.setValue(true);
    c.onExclusiveToggle(archived, rows[1], true);

    expect(rows[0].get('isArchived')!.value).toBe(true);
  });

  it('marks a cleared sibling DIRTY, so the change is saved', () => {
    // The row was changed by the user's click even though they did not touch
    // that row. A pristine control here means the save path can skip it.
    const { c, rows, primary } = threeRows();
    rows[0].get('isPrimary')!.setValue(true);
    rows[0].get('isPrimary')!.markAsPristine();

    c.onExclusiveToggle(primary, rows[1], true);

    expect(rows[0].get('isPrimary')!.dirty).toBe(true);
  });
});

describe('field-renderer - the exclusive flag through the RENDERED template', () => {
  /**
   * The tests above call `onExclusiveToggle` directly, which proves the handler
   * and NOTHING about the template being wired to it. A missing
   * `(checkedChange)` binding passes every one of them and fails in the
   * browser - the exact shape of the defect reported against this feature.
   *
   * So this one CLICKS, through the DOM, on the buttons a user clicks.
   *
   * Clicking rather than calling `addRow()` is also what makes the rows appear
   * at all: the renderer is OnPush and nothing about a FormArray growing marks
   * it dirty. In the browser the growth comes FROM a click inside the view, so
   * it always renders. Driven programmatically it does not, and the empty
   * state is a harness artefact rather than a finding.
   */
  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [FieldRendererComponent, TranslateModule.forRoot()],
    });
  });

  it('CLICKING the toggle in one row turns the others off', () => {
    const { fixture, group } = mount();
    const el: HTMLElement = fixture.nativeElement;

    const addButton = el.querySelector('.fr-repeat__head button') as HTMLElement;
    addButton.click();
    fixture.detectChanges();
    addButton.click();
    fixture.detectChanges();

    const rowEls = el.querySelectorAll('.fr-row');
    expect(rowEls.length).toBe(2);

    const primaryOf = (i: number) =>
      rowEls[i].querySelectorAll('app-toggle [role="switch"]')[0] as HTMLElement;

    primaryOf(0).click();
    fixture.detectChanges();

    const rows = fixture.componentInstance.rows(group, 'contacts');
    expect(rows[0].get('isPrimary')!.value).toBe(true);

    primaryOf(1).click();
    fixture.detectChanges();

    expect(rows[1].get('isPrimary')!.value).toBe(true);
    // The whole point: the first one goes off WITHOUT being touched.
    expect(rows[0].get('isPrimary')!.value).toBe(false);
    expect(primaryOf(0).getAttribute('aria-checked')).toBe('false');
  });
});
