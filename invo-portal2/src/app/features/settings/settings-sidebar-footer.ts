/**
 * The pinned footer of the settings-mode sidebar: a data-driven list of rows shown under the scrolling group list,
 * separated by a hairline. EMPTY on purpose for now — when the list is empty the footer renders nothing at all
 * (no row, no hairline). Add an entry here to put something in it; no template change is needed.
 *
 * Planned (not built): a "Help & Support" row with the app version in `trailingText`, whose `action` opens a
 * right-side Help Center panel (cards that open sub-views with a back arrow in the panel header, and a footer row of
 * links: Privacy Policy, Report a Bug, Contact us).
 */
export interface SettingsSidebarFooterItem {
  id: string;
  /** Inner SVG markup (stroke icon, 24×24 viewBox), same format as a catalog group's `icon`. */
  icon: string;
  /** i18n key of the row's label. */
  labelKey: string;
  /** Optional muted text shown at the end of the row (e.g. a version). */
  trailingText?: string;
  /** What the row does. Give exactly one of `action` (a button) or `link` (a route). */
  action?: () => void;
  link?: string;
}

export const SETTINGS_SIDEBAR_FOOTER_ITEMS: SettingsSidebarFooterItem[] = [];
