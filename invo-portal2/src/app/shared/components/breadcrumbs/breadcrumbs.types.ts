/**
 * Breadcrumbs public types.
 */

/** Built-in icon names recognised by the component (extend as needed). */
export type BreadcrumbIcon =
  | 'home'
  | 'folder'
  | 'file'
  | 'image'
  | 'settings';

/** A single segment in a breadcrumb trail. */
export interface BreadcrumbItem {
  /** Visible text for the segment. */
  label: string;

  /**
   * Angular RouterLink target — array form (`['/media', id]`) or string form
   * (`'/media'`). Mutually exclusive with `href`.
   */
  routerLink?: any[] | string;

  /** External link (`<a href>`). Mutually exclusive with `routerLink`. */
  href?: string;

  /** Query params forwarded to RouterLink. */
  queryParams?: Record<string, any>;

  /** Optional icon rendered before the label. */
  icon?: BreadcrumbIcon;

  /**
   * If true, the item renders as an icon-only pill (the label is omitted).
   * Requires `icon` to be set. Use for the leading "Home" segment to keep
   * long trails visually compact.
   */
  iconOnly?: boolean;

  /**
   * Arbitrary payload — passed back to consumers via the `(itemClick)`
   * event so they can correlate the click with their own data model.
   */
  data?: unknown;
}

/** Visual style for separators between segments. */
export type BreadcrumbSeparator = 'chevron' | 'slash' | 'dot';
