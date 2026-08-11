# Arabic needed — 28 HR terms for HR staff, not a translator

**For:** whoever runs HR/payroll here.
**Not for a translation agency** — these are Bahrain employment terms where the
literal Arabic is often not the word used on a contract or in Ministry of
Labour paperwork. The rest of the Arabic (about 90 ordinary UI strings, plus 28
guided-tour steps) is being handled separately and is not your problem.

**What to do:** write the Arabic your staff and your contracts actually use in
the empty column. If a term is written in English on your paperwork, say so —
"leave in English" is a valid and useful answer. If two departments say it
differently, tell us which one wins.

**Please don't** translate literally where a conventional term exists. That is
the entire reason this list is separate.

These 28 appear on the **Employment details** and **Personal details** cards of
the employee form. Nothing else in the product depends on them.

---

## 1. Employment details — field labels (9)

| English | Arabic (fill in) | Key | What it means / where it appears |
|---|---|---|---|
| Seniority date | | `FIELDS.EMPLOYMENT.SENIORITY_DATE` | Date the employee's service is counted from for entitlements. Usually the hire date, but not on a rehire or an internal transfer. |
| Defaults to the hire date; differs on a rehire or a transfer. | | `FIELDS.EMPLOYMENT.SENIORITY_DATE_HINT` | Helper line under the field above. |
| Probation (months) | | `FIELDS.EMPLOYMENT.PROBATION_MONTHS` | Length of the probation period, entered as a number of months. |
| Probation ends | | `FIELDS.EMPLOYMENT.PROBATION_END` | The date probation finishes. |
| Notice period (days) | | `FIELDS.EMPLOYMENT.NOTICE_PERIOD_DAYS` | Notice either side must give to end the contract, in days. |
| Cost centre | | `FIELDS.EMPLOYMENT.COST_CENTER` | Accounting code the employee's cost is booked against. May well stay in English. |
| Grade | | `FIELDS.EMPLOYMENT.JOB_GRADE` | The employee's pay/job grade. Field label for the A–E list below. |
| Contracted hours per week | | `FIELDS.EMPLOYMENT.WEEKLY_HOURS` | Weekly hours in the contract. |
| Drives overtime and part-time proration. | | `FIELDS.EMPLOYMENT.WEEKLY_HOURS_HINT` | Helper line under the field above. "Proration" = scaling pay/leave down for part-timers. |

## 2. Grade values (5)

Dropdown options under **Grade**. If your grades have real names — bands, levels,
numbers — tell us and we will change the list rather than translate A–E.

| English | Arabic (fill in) | Key |
|---|---|---|
| Grade A | | `OPTIONS.JOB_GRADE.A` |
| Grade B | | `OPTIONS.JOB_GRADE.B` |
| Grade C | | `OPTIONS.JOB_GRADE.C` |
| Grade D | | `OPTIONS.JOB_GRADE.D` |
| Grade E | | `OPTIONS.JOB_GRADE.E` |

## 3. Employment status and type (5)

These carry legal weight — they describe the employee's standing, and the wrong
word on screen is the wrong word in a conversation with an employee.

| English | Arabic (fill in) | Key | What it means |
|---|---|---|---|
| Probation | | `OPTIONS.EMPLOYMENT_STATUS.PROBATION` | Still within the probation period. |
| Notice period | | `OPTIONS.EMPLOYMENT_STATUS.NOTICE_PERIOD` | Notice has been given; employment has not ended yet. |
| Suspended | | `OPTIONS.EMPLOYMENT_STATUS.SUSPENDED` | Stood down, usually pending a disciplinary outcome. Employment continues. |
| Terminated | | `OPTIONS.EMPLOYMENT_STATUS.TERMINATED` | Employment has ended. Covers resignation and dismissal alike — if you need those distinguished on screen, say so. |
| Contract | | `OPTIONS.EMPLOYMENT_TYPE.CONTRACT` | Employment **type**, alongside Full-time and Part-time: a fixed-term contract. Not the document. |

## 4. Education levels (5)

Qualification names as recognised in Bahrain, not literal translations.

| English | Arabic (fill in) | Key |
|---|---|---|
| High school | | `OPTIONS.EDUCATION_LEVEL.HIGH_SCHOOL` |
| Diploma | | `OPTIONS.EDUCATION_LEVEL.DIPLOMA` |
| Bachelor's degree | | `OPTIONS.EDUCATION_LEVEL.BACHELOR` |
| Master's degree | | `OPTIONS.EDUCATION_LEVEL.MASTER` |
| Doctorate | | `OPTIONS.EDUCATION_LEVEL.DOCTORATE` |

## 5. Dependants (4)

On the **Personal details** card, in the dependants list — the employee's family
members recorded for insurance and visa purposes.

| English | Arabic (fill in) | Key | What it means |
|---|---|---|---|
| CPR number | | `FIELDS.PROFILE.DEPENDENT_CPR` | The dependant's Bahraini personal number. Please give the exact form you use on paperwork. |
| On a family visa | | `FIELDS.PROFILE.DEPENDENT_IS_ON_VISA` | Tick box — is this dependant on the employee's family visa? |
| Covered by insurance | | `FIELDS.PROFILE.DEPENDENT_IS_INSURED` | Tick box — is this dependant on the company medical policy? |
| Used later for insurance and family visas. | | `FIELDS.PROFILE.DEPENDENTS_HINT` | Helper line under the dependants list. |

---

## Notes for whoever applies the answers

- Every key above is prefixed `EMPLOYEES.` in `ar.json` — the table drops the
  prefix for readability. All 28 currently hold a `TODO_AR` placeholder.
- All 28 exist in `en.json` and are `TODO_AR` in `ar.json`; verified, not assumed.
- The two card titles (`FORM.PERSONAL_DETAILS`, `FORM.EMPLOYMENT_DETAILS`) are
  ordinary UI strings and are **not** here.
- Replacing a `TODO_AR` value does not need a code change. The i18n guard
  (`employee-form.i18n.spec.ts`) checks that keys *resolve*, not that they are
  translated, so a `TODO_AR` string passes today and a real Arabic string will
  too. If a key is deleted rather than filled, that spec fails and names it.
- "Leave in English" means leaving the English text as the Arabic value, not
  deleting the key.
