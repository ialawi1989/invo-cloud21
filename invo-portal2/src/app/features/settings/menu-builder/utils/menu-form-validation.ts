import type { Menu } from '../services/menu-builder.types';
import { toSeconds } from './menu-hours';

/**
 * Client-side checks that mirror the server's (so most mistakes never cost a round trip). Keys:
 *   'name' | 'startAt' | 'endAt' | 'branchIds' | `section:<sectionId>`  -> an error code (see MENU_BUILDER.ERR.*)
 */
export type MenuFormErrors = Record<string, string>;

export const sectionErrorKey = (id: string) => `section:${id}`;

export function validateMenuForm(menu: Menu, idOf: (s: Menu['sections'][number]) => string): MenuFormErrors {
  const errors: MenuFormErrors = {};
  if (!menu.name.trim()) errors['name'] = 'REQUIRED';

  const start = toSeconds(menu.startAt, -1);
  const end = toSeconds(menu.endAt, -1);
  if (start < 0) errors['startAt'] = 'INVALID_TIME';
  if (end < 0) errors['endAt'] = 'INVALID_TIME';
  // An end earlier than the start is an overnight window; the same time twice is an empty one.
  else if (start >= 0 && start === end) errors['endAt'] = 'SAME_AS_START';

  if (menu.branchIds.length === 0) errors['branchIds'] = 'REQUIRED';

  const seen = new Set<string>();
  for (const s of menu.sections) {
    const name = s.name.trim().toLowerCase();
    if (!name) errors[sectionErrorKey(idOf(s))] = 'SECTION_REQUIRED';
    else if (seen.has(name)) errors[sectionErrorKey(idOf(s))] = 'DUPLICATE_NAME';
    else seen.add(name);
  }
  return errors;
}

/** Order the form shows its fields in: used to scroll to the first one that is wrong. */
export function firstInvalidKey(errors: MenuFormErrors, sectionOrder: string[]): string | null {
  for (const k of ['name', 'startAt', 'endAt', 'branchIds']) if (errors[k]) return k;
  for (const id of sectionOrder) if (errors[sectionErrorKey(id)]) return sectionErrorKey(id);
  return null;
}
