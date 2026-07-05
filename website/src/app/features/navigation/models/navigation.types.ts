/**
 * Render-only navigation models for the storefront. These mirror the
 * shapes the control-panel navigation builder saves (`NavigationList`
 * / `MobileIconBarList`), but kept deliberately light — the storefront
 * only reads them.
 *
 * The CP builder stores a *flat* list with a `depth` field rather than
 * a nested tree (top-level = depth 0, sub-items = depth 1/2). Use
 * {@link buildNavTree} to turn that flat list into a render tree.
 */

export interface NavMediaUrl {
  defaultUrl?: string | null;
  thumbnailUrl?: string | null;
}

export interface NavMegaColumn {
  title?: string;
  width?: number;
  items: NavItem[];
}

export interface NavItem {
  uId?: string;
  name: string;
  type: string;
  customUrl?: string;
  abbr?: string;
  depth: number;
  isMegaMenu?: boolean;
  megaColumns?: NavMegaColumn[];
  megaWidth?: string;
  customWidth?: number;
  mediaUrl?: NavMediaUrl;
  translation?: Record<string, { name?: string }>;
  /** Built client-side from `depth` — never present in the wire data. */
  children?: NavItem[];
}

export interface NavMenu {
  id?: string;
  name?: string;
  isPrimaryMenu?: boolean;
  isFooterMenu?: boolean;
  list: NavItem[];
}

export interface MobileIconItem {
  name: string;
  slug: string;
  enabled: boolean;
  icon?: string;
  translation?: { title?: { en?: string; ar?: string } };
}

export interface MobileIconBar {
  list: MobileIconItem[];
}

/**
 * Turn the builder's flat depth-list into a nested tree. Each item
 * attaches to the most recent ancestor whose depth is exactly one
 * less than its own; orphans (depth jumps) fall back to the root.
 */
export function buildNavTree(list: NavItem[]): NavItem[] {
  const roots: NavItem[] = [];
  // Stack of the last-seen item at each depth.
  const lastAtDepth: NavItem[] = [];

  for (const raw of list ?? []) {
    const node: NavItem = { ...raw, children: [] };
    const depth = Math.max(0, node.depth || 0);

    if (depth === 0) {
      roots.push(node);
    } else {
      const parent = lastAtDepth[depth - 1];
      if (parent) (parent.children ??= []).push(node);
      else roots.push(node); // depth jump with no parent → promote to root
    }
    lastAtDepth[depth] = node;
    lastAtDepth.length = depth + 1; // drop deeper stale entries
  }
  return roots;
}

/** Localised display name for the active language, falling back to `name`. */
export function navName(item: { name: string; translation?: Record<string, { name?: string }> }, lang: string): string {
  return item.translation?.[lang]?.name || item.name || '';
}

/**
 * Map a nav item to a storefront href. Best-effort — keeps every
 * type→path rule in one place so it can be tuned without touching the
 * renderer. `customUrl` items pass through verbatim.
 */
export function resolveHref(item: NavItem, lang = 'en'): string {
  const slug = (item.abbr || '').trim();
  switch (item.type) {
    case 'customUrl':
    case 'custom':
      return item.customUrl || '#';
    case 'mega':
      return '#';
    case 'page':
    case 'pages':
      return slug === 'home' || slug === '/' ? `/${lang}` : `/${lang}/${slug}`;
    case 'collections':
    case 'collection':
      return `/${lang}/collection/${slug}`;
    case 'shop':
      return `/${lang}/shop`;
    case 'menu':
      return `/${lang}/menu`;
    case 'orders':
      return `/${lang}/account/orders`;
    case 'reservations':
      return `/${lang}/account/reservations`;
    case 'services':
      return `/${lang}/${slug}`;
    case 'image':
      return item.customUrl || '#';
    default:
      return item.customUrl || (slug ? `/${lang}/${slug}` : '#');
  }
}

/** Map a mobile-bar slug to a storefront href. */
export function mobileHref(slug: string, lang = 'en'): string {
  switch (slug) {
    case '/':            return `/${lang}`;
    case 'search':       return `/${lang}/search`;
    case 'toTop':        return '#top';
    case 'categories':   return `/${lang}/categories`;
    case 'wishlist':     return `/${lang}/wishlist`;
    case 'cart':         return `/${lang}/cart`;
    case 'account':      return `/${lang}/account`;
    case 'menu':         return `/${lang}/menu`;
    case 'shop':         return `/${lang}/shop`;
    case 'my-orders':    return `/${lang}/account/orders`;
    case 'appointments': return `/${lang}/account/reservations`;
    default:             return `/${lang}/${slug}`;
  }
}
