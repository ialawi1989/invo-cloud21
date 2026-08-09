/**
 * Translate a server label key into the portal's namespace.
 *
 * The server sends `employees.documents.type.nationalId` and
 * `employees.assets.category.idCard`; this feature's translations live under
 * `EMPLOYEES.DOCUMENTS.TYPE.NATIONAL_ID` and `EMPLOYEES.ASSETS.CATEGORY.ID_CARD`.
 * The two conventions differ, neither side is going to change, so the mapping is
 * mechanical and stated in exactly one place: dots preserved, camelCase split,
 * upper snake case.
 *
 * A key with no translation renders as itself, which is deliberately ugly — a
 * missing type label should be obvious rather than blank.
 *
 * Its own file rather than a method on the component so it can be tested
 * without compiling a template.
 */
export function portalKey(labelKey: string): string {
  return labelKey
    .split('.')
    .map(seg => seg.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toUpperCase())
    .join('.');
}
