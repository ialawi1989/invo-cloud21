import { describe, expect, it } from 'vitest';
import { FormBuilder, FormArray, FormGroup } from '@angular/forms';

import { FieldDescriptor, FieldGroupDescriptor } from '../models/field-manifest.types';
import {
  applyManifestRules,
  buildGroupControl,
  buildRowGroup,
  evalCondition,
  extractGroupValue,
  patchGroupValue,
} from './manifest-form.util';

const fb = new FormBuilder();

const FIELDS: FieldDescriptor[] = [
  { key: 'employeeNumber', type: 'text', labelKey: 'x', required: true },
  { key: 'department', type: 'text', labelKey: 'x' },
  { key: 'employmentType', type: 'select', labelKey: 'x', options: [] },
  {
    key: 'contractEndDate',
    type: 'date',
    labelKey: 'x',
    visibleWhen: "employment.employmentType == 'Contract'",
    requiredWhen: "employment.employmentType == 'Contract'",
  },
  { key: 'isDepartmentHead', type: 'boolean', labelKey: 'x' },
  { key: 'noticePeriodDays', type: 'number', labelKey: 'x', defaultValue: 30 },
  { key: 'probationEndDate', type: 'computed', labelKey: 'x' },
  {
    key: 'address',
    type: 'group',
    labelKey: 'x',
    fields: [
      { key: 'country', type: 'select', labelKey: 'x', options: [] },
      { key: 'block', type: 'text', labelKey: 'x', requiredWhen: "employment.address.country == 'BH'" },
    ],
  },
  {
    key: 'contacts',
    type: 'group[]',
    labelKey: 'x',
    fields: [
      { key: 'name', type: 'text', labelKey: 'x', required: true },
      { key: 'isPrimary', type: 'boolean', labelKey: 'x' },
    ],
  },
];

const GROUPS: FieldGroupDescriptor[] = [{ key: 'employment', titleKey: 'x', fields: FIELDS }];

/** A root form holding one manifest group, as the employee form builds it. */
function rootForm(seedDefaults = false): FormGroup {
  const root = fb.group({});
  root.addControl('employment', buildGroupControl(fb, FIELDS, { seedDefaults }));
  return root;
}

describe('evalCondition', () => {
  const values = { employment: { employmentType: 'Contract', isDepartmentHead: false } };

  it('compares against a literal', () => {
    expect(evalCondition("employment.employmentType == 'Contract'", values)).toBe(true);
    expect(evalCondition("employment.employmentType != 'Contract'", values)).toBe(false);
  });

  it('treats an unset value as absent, not as a mismatch', () => {
    expect(evalCondition("employment.missing != 'BH'", values)).toBe(true);
    expect(evalCondition("employment.missing == 'BH'", values)).toBe(false);
  });

  it('supports bare and negated truthiness', () => {
    expect(evalCondition('!employment.isDepartmentHead', values)).toBe(true);
    expect(evalCondition('employment.isDepartmentHead', values)).toBe(false);
  });

  it('shows the field when the condition is unparseable', () => {
    expect(evalCondition('¯\\_(ツ)_/¯', values)).toBe(true);
    expect(evalCondition(undefined, values)).toBe(true);
  });
});

describe('buildGroupControl', () => {
  it('seeds defaults only when asked', () => {
    expect(rootForm(true).get('employment.noticePeriodDays')!.value).toBe(30);
    expect(rootForm(false).get('employment.noticePeriodDays')!.value).toBe(null);
  });

  it('creates no control for a computed field', () => {
    expect(rootForm().get('employment.probationEndDate')).toBeNull();
  });
});

describe('extractGroupValue', () => {
  it('returns undefined for an untouched group, so no empty object is saved', () => {
    const root = rootForm();
    expect(extractGroupValue(root.get('employment') as FormGroup, FIELDS)).toBeUndefined();
  });

  it('omits false booleans and empty rows, and trims free text', () => {
    const root = rootForm();
    const employment = root.get('employment') as FormGroup;
    employment.get('department')!.setValue('  Finance  ');

    const rows = employment.get('contacts') as FormArray;
    rows.push(buildRowGroup(fb, FIELDS[8].fields!));
    rows.push(buildRowGroup(fb, FIELDS[8].fields!));
    (rows.at(0) as FormGroup).get('name')!.setValue(' Ali ');

    expect(extractGroupValue(employment, FIELDS)).toEqual({
      department: 'Finance',
      contacts: [{ name: 'Ali' }],
    });
  });

  it('never emits a computed field', () => {
    const root = rootForm(true);
    const employment = root.get('employment') as FormGroup;
    employment.get('employeeNumber')!.setValue('E-1');
    expect(extractGroupValue(employment, FIELDS)).toEqual({
      employeeNumber: 'E-1',
      noticePeriodDays: 30,
    });
  });
});

describe('patchGroupValue', () => {
  it('reads dates back as Date and rebuilds repeatable rows', () => {
    const root = rootForm();
    const employment = root.get('employment') as FormGroup;
    patchGroupValue(fb, employment, FIELDS, {
      contractEndDate: '2026-03-09',
      contacts: [{ name: 'Ali', isPrimary: true }],
    });

    const date = employment.get('contractEndDate')!.value as Date;
    expect([date.getFullYear(), date.getMonth(), date.getDate()]).toEqual([2026, 2, 9]);
    expect((employment.get('contacts') as FormArray).length).toBe(1);
  });

  it('round-trips a patched value unchanged', () => {
    const root = rootForm();
    const employment = root.get('employment') as FormGroup;
    const stored = {
      employeeNumber: 'E-1',
      contractEndDate: '2026-03-09',
      address: { country: 'BH', block: '338' },
      contacts: [{ name: 'Ali', isPrimary: true }],
    };
    patchGroupValue(fb, employment, FIELDS, stored);
    expect(extractGroupValue(employment, FIELDS)).toEqual(stored);
  });
});

describe('applyManifestRules', () => {
  it('requires a conditional field only while it is visible, keeping the value', () => {
    const root = rootForm();
    const end = root.get('employment.contractEndDate')!;

    root.get('employment.employmentType')!.setValue('Contract');
    applyManifestRules(root, GROUPS, 'strict');
    expect(end.hasError('required')).toBe(true);

    end.setValue(new Date(2026, 2, 9));
    root.get('employment.employmentType')!.setValue('Full-time');
    applyManifestRules(root, GROUPS, 'strict');
    expect(end.valid).toBe(true);
    // Hidden ≠ cleared — switching back restores what was typed.
    expect(end.value).toEqual(new Date(2026, 2, 9));
  });

  it('applies nested group conditions by full path', () => {
    const root = rootForm();
    root.get('employment.address.country')!.setValue('BH');
    applyManifestRules(root, GROUPS, 'strict');
    expect(root.get('employment.address.block')!.hasError('required')).toBe(true);

    root.get('employment.address.country')!.setValue('GB');
    applyManifestRules(root, GROUPS, 'strict');
    expect(root.get('employment.address.block')!.valid).toBe(true);
  });

  it('leaves a legacy record saveable in lenient mode', () => {
    const root = rootForm();
    applyManifestRules(root, GROUPS, 'lenient');
    expect(root.get('employment.employeeNumber')!.valid).toBe(true);

    // …but a value that exists can't be blanked back out.
    root.get('employment.employeeNumber')!.setValue('E-1');
    applyManifestRules(root, GROUPS, 'lenient');
    root.get('employment.employeeNumber')!.setValue('');
    applyManifestRules(root, GROUPS, 'lenient');
    expect(root.get('employment.employeeNumber')!.valid).toBe(true);

    // Strict mode (a new record) demands it up front.
    applyManifestRules(root, GROUPS, 'strict');
    expect(root.get('employment.employeeNumber')!.hasError('required')).toBe(true);
  });

  it('validates rows strictly whatever the record age', () => {
    const rows = rootForm().get('employment.contacts') as FormArray;
    rows.push(buildRowGroup(fb, FIELDS[8].fields!));
    expect((rows.at(0) as FormGroup).get('name')!.hasError('required')).toBe(true);
  });
});
