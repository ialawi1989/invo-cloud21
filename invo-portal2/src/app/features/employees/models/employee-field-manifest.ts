/**
 * Employee field manifest — **offline fallback only. Not the source of truth.**
 *
 * The canonical manifest lives in the backend at
 * `InvoCloudBack/src/repo/admin/employeeFieldManifest.ts` and is served by
 * `GET employee/fieldManifest`. `EmployeeFieldManifestService` asks for that
 * first and uses it whenever it can be reached — which is the normal case — so
 * this file is what keeps the form rendering when the endpoint is unreachable
 * or a deployment is mid-flight.
 *
 * Two consequences worth knowing before editing it:
 *
 *  • **A field added only here is invisible in practice.** The backend answers
 *    every real request, so its copy wins. Add the field there; mirror it here
 *    only to keep the offline experience honest.
 *  • **Divergence is silent.** Nothing compares the two at build time — they are
 *    in different repositories. If this file drifts, the only symptom is that
 *    the form looks different when the backend is down.
 *
 * Every key here is namespaced under its group, so none of the 13 existing
 * top-level fields is touched.
 *
 * Deliberately **not** in phase 1:
 *  • `employment.contractDocument`, `profile.education[].certificate` — `file`
 *    fields, and the shared uploader is phase-2 work.
 *  • `employment.history[]` — system-appended by the backend, never edited here.
 *  • `employment.departmentId` / `positionId` — the lookup entities don't exist
 *    yet, so they ship as trimmed free text with an autocomplete over the
 *    values already in use. Swapping them to `reference` later is a two-line
 *    change here, and the stored strings are the seed data for the lookup.
 */

import {
  EDUCATION_LEVEL_OPTIONS,
  EMPLOYMENT_STATUS_OPTIONS,
  EMPLOYMENT_TYPE_OPTIONS,
  GENDER_OPTIONS,
  JOB_GRADE_OPTIONS,
  MARITAL_STATUS_OPTIONS,
  RELATIONSHIP_OPTIONS,
} from './employee-catalogs';
import { FieldManifest } from './field-manifest.types';

/** E.164-ish: optional leading `+` then 7–15 digits. Kept permissive — this is
 *  a format hint, not a carrier lookup. */
const PHONE_PATTERN = '^\\+?[0-9]{7,15}$';

export const EMPLOYEE_FIELD_MANIFEST: FieldManifest = {
  version: '1.0.0-phase1',
  groups: [
    // ─── Profile ───────────────────────────────────────────────────────────
    {
      key: 'profile',
      titleKey: 'EMPLOYEES.FORM.PERSONAL_DETAILS',
      fields: [
        {
          key: 'nameAr',
          type: 'text',
          labelKey: 'EMPLOYEES.FIELDS.PROFILE.NAME_AR',
          hintKey: 'EMPLOYEES.FIELDS.PROFILE.NAME_AR_HINT',
          maxLength: 120,
          access: 'self',
        },
        {
          key: 'employeeNumber',
          type: 'text',
          labelKey: 'EMPLOYEES.FIELDS.PROFILE.EMPLOYEE_NUMBER',
          hintKey: 'EMPLOYEES.FIELDS.PROFILE.EMPLOYEE_NUMBER_HINT',
          required: true,
          maxLength: 40,
          access: 'internal',
        },
        {
          key: 'mobile',
          type: 'phone',
          labelKey: 'EMPLOYEES.FIELDS.PROFILE.MOBILE',
          required: true,
          pattern: PHONE_PATTERN,
          access: 'self',
        },
        {
          key: 'personalEmail',
          type: 'email',
          labelKey: 'EMPLOYEES.FIELDS.PROFILE.PERSONAL_EMAIL',
          hintKey: 'EMPLOYEES.FIELDS.PROFILE.PERSONAL_EMAIL_HINT',
          access: 'restricted',
        },
        {
          key: 'gender',
          type: 'select',
          labelKey: 'EMPLOYEES.FIELDS.PROFILE.GENDER',
          required: true,
          options: GENDER_OPTIONS,
          access: 'internal',
        },
        {
          key: 'dateOfBirth',
          type: 'date',
          labelKey: 'EMPLOYEES.FIELDS.PROFILE.DATE_OF_BIRTH',
          required: true,
          access: 'internal',
        },
        {
          key: 'nationality',
          type: 'select',
          labelKey: 'EMPLOYEES.FIELDS.PROFILE.NATIONALITY',
          required: true,
          optionSource: 'countries',
          access: 'internal',
        },
        {
          key: 'maritalStatus',
          type: 'select',
          labelKey: 'EMPLOYEES.FIELDS.PROFILE.MARITAL_STATUS',
          options: MARITAL_STATUS_OPTIONS,
          access: 'internal',
        },
        {
          key: 'languages',
          type: 'multiselect',
          labelKey: 'EMPLOYEES.FIELDS.PROFILE.LANGUAGES',
          optionSource: 'languages',
          access: 'internal',
        },
        {
          key: 'address',
          type: 'group',
          labelKey: 'EMPLOYEES.FIELDS.PROFILE.ADDRESS',
          access: 'internal',
          fields: [
            {
              key: 'country',
              type: 'select',
              labelKey: 'EMPLOYEES.FIELDS.PROFILE.ADDRESS_COUNTRY',
              required: true,
              optionSource: 'countries',
            },
            {
              key: 'city',
              type: 'text',
              labelKey: 'EMPLOYEES.FIELDS.PROFILE.ADDRESS_CITY',
              required: true,
              maxLength: 80,
            },
            // Bahraini addresses are block / road / building, not a street line.
            {
              key: 'block',
              type: 'text',
              labelKey: 'EMPLOYEES.FIELDS.PROFILE.ADDRESS_BLOCK',
              requiredWhen: "profile.address.country == 'BH'",
              maxLength: 20,
            },
            {
              key: 'road',
              type: 'text',
              labelKey: 'EMPLOYEES.FIELDS.PROFILE.ADDRESS_ROAD',
              requiredWhen: "profile.address.country == 'BH'",
              maxLength: 40,
            },
            {
              key: 'building',
              type: 'text',
              labelKey: 'EMPLOYEES.FIELDS.PROFILE.ADDRESS_BUILDING',
              requiredWhen: "profile.address.country == 'BH'",
              maxLength: 40,
            },
            {
              key: 'flat',
              type: 'text',
              labelKey: 'EMPLOYEES.FIELDS.PROFILE.ADDRESS_FLAT',
              maxLength: 20,
            },
            {
              key: 'postalCode',
              type: 'text',
              labelKey: 'EMPLOYEES.FIELDS.PROFILE.ADDRESS_POSTAL_CODE',
              maxLength: 20,
            },
          ],
        },
        {
          key: 'emergencyContacts',
          type: 'group[]',
          labelKey: 'EMPLOYEES.FIELDS.PROFILE.EMERGENCY_CONTACTS',
          rowLabelKey: 'EMPLOYEES.FIELDS.PROFILE.EMERGENCY_CONTACT_ROW',
          addLabelKey: 'EMPLOYEES.FIELDS.PROFILE.ADD_EMERGENCY_CONTACT',
          access: 'internal',
          fields: [
            { key: 'name', type: 'text', labelKey: 'EMPLOYEES.FIELDS.PROFILE.CONTACT_NAME', required: true, maxLength: 120 },
            { key: 'relationship', type: 'select', labelKey: 'EMPLOYEES.FIELDS.PROFILE.CONTACT_RELATIONSHIP', required: true, options: RELATIONSHIP_OPTIONS },
            { key: 'phone', type: 'phone', labelKey: 'EMPLOYEES.FIELDS.PROFILE.CONTACT_PHONE', required: true, pattern: PHONE_PATTERN },
            { key: 'isPrimary', type: 'boolean', labelKey: 'EMPLOYEES.FIELDS.PROFILE.CONTACT_IS_PRIMARY' },
          ],
        },
        {
          key: 'dependents',
          type: 'group[]',
          labelKey: 'EMPLOYEES.FIELDS.PROFILE.DEPENDENTS',
          hintKey: 'EMPLOYEES.FIELDS.PROFILE.DEPENDENTS_HINT',
          rowLabelKey: 'EMPLOYEES.FIELDS.PROFILE.DEPENDENT_ROW',
          addLabelKey: 'EMPLOYEES.FIELDS.PROFILE.ADD_DEPENDENT',
          access: 'restricted',
          fields: [
            { key: 'name', type: 'text', labelKey: 'EMPLOYEES.FIELDS.PROFILE.DEPENDENT_NAME', required: true, maxLength: 120 },
            { key: 'relationship', type: 'select', labelKey: 'EMPLOYEES.FIELDS.PROFILE.DEPENDENT_RELATIONSHIP', required: true, options: RELATIONSHIP_OPTIONS },
            { key: 'dateOfBirth', type: 'date', labelKey: 'EMPLOYEES.FIELDS.PROFILE.DEPENDENT_DOB', required: true },
            { key: 'cprNumber', type: 'text', labelKey: 'EMPLOYEES.FIELDS.PROFILE.DEPENDENT_CPR', maxLength: 30 },
            { key: 'isInsured', type: 'boolean', labelKey: 'EMPLOYEES.FIELDS.PROFILE.DEPENDENT_IS_INSURED' },
            { key: 'isOnVisa', type: 'boolean', labelKey: 'EMPLOYEES.FIELDS.PROFILE.DEPENDENT_IS_ON_VISA' },
          ],
        },
        {
          key: 'education',
          type: 'group[]',
          labelKey: 'EMPLOYEES.FIELDS.PROFILE.EDUCATION',
          rowLabelKey: 'EMPLOYEES.FIELDS.PROFILE.EDUCATION_ROW',
          addLabelKey: 'EMPLOYEES.FIELDS.PROFILE.ADD_EDUCATION',
          access: 'internal',
          fields: [
            { key: 'level', type: 'select', labelKey: 'EMPLOYEES.FIELDS.PROFILE.EDUCATION_LEVEL', required: true, options: EDUCATION_LEVEL_OPTIONS },
            { key: 'institution', type: 'text', labelKey: 'EMPLOYEES.FIELDS.PROFILE.EDUCATION_INSTITUTION', required: true, maxLength: 160 },
            { key: 'graduationYear', type: 'number', labelKey: 'EMPLOYEES.FIELDS.PROFILE.EDUCATION_YEAR', required: true, min: 1950, max: 2100 },
            { key: 'fieldOfStudy', type: 'text', labelKey: 'EMPLOYEES.FIELDS.PROFILE.EDUCATION_FIELD', maxLength: 160 },
            // Verification (spec 4.1). Mirrors the server manifest exactly —
            // this file is the fallback used when the endpoint is unavailable,
            // so a field present in one and absent from the other renders
            // differently depending on whether a request succeeded.
            { key: 'isVerified', type: 'boolean', labelKey: 'EMPLOYEES.FIELDS.PROFILE.EDUCATION_IS_VERIFIED', access: 'restricted' },
            { key: 'verifiedBy', type: 'computed', labelKey: 'EMPLOYEES.FIELDS.PROFILE.EDUCATION_VERIFIED_BY', access: 'restricted' },
            { key: 'verifiedAt', type: 'computed', labelKey: 'EMPLOYEES.FIELDS.PROFILE.EDUCATION_VERIFIED_AT', access: 'restricted' },
          ],
        },
      ],
    },

    // ─── Employment ────────────────────────────────────────────────────────
    {
      key: 'employment',
      titleKey: 'EMPLOYEES.FORM.EMPLOYMENT_DETAILS',
      fields: [
        {
          key: 'seniorityDate',
          type: 'date',
          labelKey: 'EMPLOYEES.FIELDS.EMPLOYMENT.SENIORITY_DATE',
          hintKey: 'EMPLOYEES.FIELDS.EMPLOYMENT.SENIORITY_DATE_HINT',
          access: 'restricted',
        },
        {
          key: 'employmentType',
          type: 'select',
          labelKey: 'EMPLOYEES.FIELDS.EMPLOYMENT.EMPLOYMENT_TYPE',
          required: true,
          options: EMPLOYMENT_TYPE_OPTIONS,
          access: 'internal',
        },
        {
          key: 'status',
          type: 'select',
          labelKey: 'EMPLOYEES.FIELDS.EMPLOYMENT.STATUS',
          required: true,
          options: EMPLOYMENT_STATUS_OPTIONS,
          access: 'internal',
        },
        {
          key: 'department',
          type: 'text',
          labelKey: 'EMPLOYEES.FIELDS.EMPLOYMENT.DEPARTMENT',
          hintKey: 'EMPLOYEES.FIELDS.EMPLOYMENT.LOOKUP_HINT',
          required: true,
          maxLength: 80,
          suggestionSource: 'departments',
          access: 'internal',
        },
        {
          key: 'position',
          type: 'text',
          labelKey: 'EMPLOYEES.FIELDS.EMPLOYMENT.POSITION',
          hintKey: 'EMPLOYEES.FIELDS.EMPLOYMENT.LOOKUP_HINT',
          required: true,
          maxLength: 80,
          suggestionSource: 'positions',
          access: 'internal',
        },
        {
          key: 'jobGrade',
          type: 'select',
          labelKey: 'EMPLOYEES.FIELDS.EMPLOYMENT.JOB_GRADE',
          options: JOB_GRADE_OPTIONS,
          access: 'restricted',
        },
        {
          key: 'isDepartmentHead',
          type: 'boolean',
          labelKey: 'EMPLOYEES.FIELDS.EMPLOYMENT.IS_DEPARTMENT_HEAD',
          access: 'internal',
        },
        {
          key: 'reportsTo',
          type: 'reference',
          labelKey: 'EMPLOYEES.FIELDS.EMPLOYMENT.REPORTS_TO',
          // A department head reports outside the department, so the manager is
          // optional for them and required for everyone else.
          requiredWhen: '!employment.isDepartmentHead',
          // Paged + searched server-side: the employee table is unbounded, so
          // a fixed-size fetch would quietly hide anyone past the cut-off.
          loaderSource: 'employees',
          access: 'internal',
        },
        {
          key: 'costCenter',
          type: 'text',
          labelKey: 'EMPLOYEES.FIELDS.EMPLOYMENT.COST_CENTER',
          maxLength: 60,
          access: 'restricted',
        },
        {
          key: 'probationMonths',
          type: 'number',
          labelKey: 'EMPLOYEES.FIELDS.EMPLOYMENT.PROBATION_MONTHS',
          requiredWhen: "employment.employmentType != 'Contract'",
          visibleWhen: "employment.employmentType != 'Contract'",
          min: 0,
          max: 6,
          access: 'internal',
        },
        {
          key: 'probationEndDate',
          type: 'computed',
          labelKey: 'EMPLOYEES.FIELDS.EMPLOYMENT.PROBATION_END',
          visibleWhen: "employment.employmentType != 'Contract'",
          access: 'internal',
        },
        {
          key: 'contractStartDate',
          type: 'date',
          labelKey: 'EMPLOYEES.FIELDS.EMPLOYMENT.CONTRACT_START',
          visibleWhen: "employment.employmentType == 'Contract'",
          requiredWhen: "employment.employmentType == 'Contract'",
          access: 'internal',
        },
        {
          key: 'contractEndDate',
          type: 'date',
          labelKey: 'EMPLOYEES.FIELDS.EMPLOYMENT.CONTRACT_END',
          hintKey: 'EMPLOYEES.FIELDS.EMPLOYMENT.CONTRACT_DOCUMENT_HINT',
          visibleWhen: "employment.employmentType == 'Contract'",
          requiredWhen: "employment.employmentType == 'Contract'",
          access: 'internal',
        },
        {
          key: 'noticePeriodDays',
          type: 'number',
          labelKey: 'EMPLOYEES.FIELDS.EMPLOYMENT.NOTICE_PERIOD_DAYS',
          required: true,
          min: 0,
          max: 365,
          defaultValue: 30,
          access: 'internal',
        },
        {
          key: 'weeklyHours',
          type: 'number',
          labelKey: 'EMPLOYEES.FIELDS.EMPLOYMENT.WEEKLY_HOURS',
          hintKey: 'EMPLOYEES.FIELDS.EMPLOYMENT.WEEKLY_HOURS_HINT',
          required: true,
          min: 1,
          max: 84,
          defaultValue: 40,
          access: 'internal',
        },
      ],
    },
  ],
};
