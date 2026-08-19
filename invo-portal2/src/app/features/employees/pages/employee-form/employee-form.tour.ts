import { GuidedTourStep } from '@shared/services/guided-tour.service';

/**
 * Guided tour for the employee form.
 *
 * Data, not code: each step names the `data-tour` anchor it points at and the
 * two i18n keys for its copy. Nothing here knows about feature flags or roles —
 * `GuidedTourService` drops any step whose anchor isn't currently rendered, so
 * the same catalog serves every state the form can be in:
 *
 *  • `EMPLOYEE_HR_FIELDS` off  → the two HR cards don't mount → their steps go.
 *  • POS-only account, or system access off → no email/password block → those
 *    steps go.
 *  • A record with no branches yet → no primary-branch star → that step goes,
 *    while the Branch Assignment step (whose copy explains the star) stays.
 *  • The create wizard shows ONE step at a time → the anchors on the other
 *    three steps are not in the DOM → the tour becomes a tour of the step the
 *    user is actually on, with no per-step catalog to maintain.
 *
 * Bumping `EMPLOYEE_TOUR_KEY` re-shows the tour for everyone; do that when the
 * form changes enough that the walkthrough would otherwise mislead.
 */
// v2: the create flow became a four-step wizard and the record page became a
// read-only overview. A tour written for one long page would now walk people
// past cards that are on a different step.
export const EMPLOYEE_TOUR_KEY = 'employee_form_v2';

/** Anchor names, exported so the template and its test agree on the spelling. */
export const EMPLOYEE_TOUR_ANCHORS = {
  stepper: 'emp-stepper',
  systemAccess: 'emp-system-access',
  basic: 'emp-basic',
  email: 'emp-email',
  password: 'emp-password',
  roles: 'emp-roles',
  access: 'emp-access',
  image: 'emp-image',
  branches: 'emp-branches',
  primaryStar: 'emp-primary-star',
  employment: 'emp-employment',
  hrProfile: 'emp-hr-profile',
  hrEmployment: 'emp-hr-employment',
  payment: 'emp-payment',
} as const;

const A = EMPLOYEE_TOUR_ANCHORS;

export const EMPLOYEE_FORM_TOUR: GuidedTourStep[] = [
  {
    titleKey: 'EMPLOYEES.TOUR.INTRO.TITLE',
    bodyKey: 'EMPLOYEES.TOUR.INTRO.BODY',
    align: 'center',
  },
  // Wizard only — absent when editing, where there is no step strip and the
  // step-by-step copy would describe a flow the user is not in.
  {
    anchor: A.stepper,
    titleKey: 'EMPLOYEES.TOUR.STEPPER.TITLE',
    bodyKey: 'EMPLOYEES.TOUR.STEPPER.BODY',
    side: 'block-end',
  },
  {
    anchor: A.systemAccess,
    titleKey: 'EMPLOYEES.TOUR.SYSTEM_ACCESS.TITLE',
    bodyKey: 'EMPLOYEES.TOUR.SYSTEM_ACCESS.BODY',
    side: 'block-end',
  },
  {
    anchor: A.basic,
    titleKey: 'EMPLOYEES.TOUR.BASIC.TITLE',
    bodyKey: 'EMPLOYEES.TOUR.BASIC.BODY',
    side: 'block-end',
  },
  // Only rendered for a cloud account — skipped for POS-only or no-access.
  {
    anchor: A.email,
    titleKey: 'EMPLOYEES.TOUR.EMAIL.TITLE',
    bodyKey: 'EMPLOYEES.TOUR.EMAIL.BODY',
    side: 'inline-end',
  },
  {
    anchor: A.password,
    titleKey: 'EMPLOYEES.TOUR.PASSWORD.TITLE',
    bodyKey: 'EMPLOYEES.TOUR.PASSWORD.BODY',
    side: 'inline-end',
  },
  {
    anchor: A.roles,
    titleKey: 'EMPLOYEES.TOUR.ROLES.TITLE',
    bodyKey: 'EMPLOYEES.TOUR.ROLES.BODY',
    side: 'block-end',
  },
  {
    anchor: A.access,
    titleKey: 'EMPLOYEES.TOUR.ACCESS.TITLE',
    bodyKey: 'EMPLOYEES.TOUR.ACCESS.BODY',
    side: 'block-end',
  },
  {
    anchor: A.image,
    titleKey: 'EMPLOYEES.TOUR.IMAGE.TITLE',
    bodyKey: 'EMPLOYEES.TOUR.IMAGE.BODY',
    side: 'inline-start',
  },
  {
    anchor: A.branches,
    titleKey: 'EMPLOYEES.TOUR.BRANCHES.TITLE',
    bodyKey: 'EMPLOYEES.TOUR.BRANCHES.BODY',
    side: 'inline-start',
  },
  // Exists only once at least one branch is selected.
  {
    anchor: A.primaryStar,
    titleKey: 'EMPLOYEES.TOUR.PRIMARY_STAR.TITLE',
    bodyKey: 'EMPLOYEES.TOUR.PRIMARY_STAR.BODY',
    side: 'inline-start',
  },
  {
    anchor: A.employment,
    titleKey: 'EMPLOYEES.TOUR.EMPLOYMENT.TITLE',
    bodyKey: 'EMPLOYEES.TOUR.EMPLOYMENT.BODY',
    side: 'inline-start',
  },
  // Both HR cards mount only behind EMPLOYEE_HR_FIELDS.
  {
    anchor: A.hrProfile,
    titleKey: 'EMPLOYEES.TOUR.HR_PROFILE.TITLE',
    bodyKey: 'EMPLOYEES.TOUR.HR_PROFILE.BODY',
    side: 'block-end',
  },
  {
    anchor: A.hrEmployment,
    titleKey: 'EMPLOYEES.TOUR.HR_EMPLOYMENT.TITLE',
    bodyKey: 'EMPLOYEES.TOUR.HR_EMPLOYMENT.BODY',
    side: 'block-end',
  },
  // Rendered only where `editBank` is held, so this step disappears for
  // everyone who could not have saved an account anyway.
  {
    anchor: A.payment,
    titleKey: 'EMPLOYEES.TOUR.PAYMENT.TITLE',
    bodyKey: 'EMPLOYEES.TOUR.PAYMENT.BODY',
    side: 'block-end',
  },
];
