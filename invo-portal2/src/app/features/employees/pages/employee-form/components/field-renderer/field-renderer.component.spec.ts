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
    expect(host.querySelector('.fr-fieldset')).toBeTruthy();
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
