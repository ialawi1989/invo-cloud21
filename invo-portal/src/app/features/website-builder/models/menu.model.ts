// ============================================
// MENU SYSTEM TYPES
// ============================================

// Menu item types from API
export type MenuItemType = 
  | 'customUrl' 
  | 'services' 
  | 'collections' 
  | 'orders' 
  | 'reservations'
  | 'page'
  | 'category'
  | 'product';

export interface MenuItem {
  uId: string;
  name: string;
  type: MenuItemType;
  abbr?: string;
  customUrl?: string;
  depth?: number;
  index?: number;
  enabled?: boolean;
  icon?: string;
  translation?: {
    title?: Record<string, string>;
  };
  children?: MenuItem[];
}

export interface MenuDefinition {
  id: string;
  companyId: string;
  type: 'Menus' | 'MobileIconBar';
  name: string;
  isPrimaryMenu: boolean;
  isFooterMenu: boolean;
  isHomePage: boolean;
  translation: Record<string, any>;
  template: {
    list: MenuItem[];
  };
  createdAt: string;
}

// Mobile Icon Bar Item
export interface MobileIconBarItem {
  uId: string;
  icon: string;
  name: string;
  slug: string;
  index?: number;
  enabled?: boolean;
  translation?: {
    title?: Record<string, string>;
  };
}

// Available icon bar actions
export const MOBILE_ICON_BAR_ACTIONS = [
  { slug: '/', name: 'Home', icon: 'home' },
  { slug: 'menu', name: 'Menu', icon: 'menu' },
  { slug: 'cart', name: 'Cart', icon: 'shopping-cart' },
  { slug: 'wishlist', name: 'Wishlist', icon: 'heart' },
  { slug: 'account', name: 'Account', icon: 'user' },
  { slug: 'shop', name: 'Store', icon: 'store' },
  { slug: 'my-orders', name: 'Orders', icon: 'package' },
  { slug: 'toggleMenu', name: 'Menu Toggle', icon: 'menu' },
  { slug: 'compare', name: 'Compare', icon: 'git-compare' },
  { slug: 'toTop', name: 'To Top', icon: 'arrow-up' },
  { slug: 'search', name: 'Search', icon: 'search' },
  { slug: 'categories', name: 'Categories', icon: 'grid' },
  { slug: 'appointments', name: 'Bookings', icon: 'calendar' },
];

// Menu item type options for dropdown
export const MENU_ITEM_TYPES = [
  { value: 'customUrl', label: 'Custom URL' },
  { value: 'services', label: 'Service' },
  { value: 'collections', label: 'Collection' },
  { value: 'orders', label: 'Orders' },
  { value: 'reservations', label: 'Reservations' },
  { value: 'page', label: 'Page' },
  { value: 'category', label: 'Category' },
  { value: 'product', label: 'Product' },
];

// Service types for menu items
export const SERVICE_TYPES = [
  { abbr: 'pickup-menu', name: 'Pickup' },
  { abbr: 'delivery-menu', name: 'Delivery' },
  { abbr: 'appointments', name: 'Appointments' },
  { abbr: 'table-reservation', name: 'Table Reservation' },
];

// Helper functions
export function generateMenuItemId(): string {
  return `item-${crypto.randomUUID()}`;
}

export function flattenMenuItems(items: MenuItem[]): MenuItem[] {
  const result: MenuItem[] = [];
  const flatten = (list: MenuItem[], depth: number = 0) => {
    list.forEach((item, index) => {
      result.push({ ...item, depth, index });
      if (item.children) {
        flatten(item.children, depth + 1);
      }
    });
  };
  flatten(items);
  return result;
}

export function buildMenuTree(flatItems: MenuItem[]): MenuItem[] {
  const rootItems: MenuItem[] = [];
  const itemMap = new Map<string, MenuItem>();
  
  // First pass: create map
  flatItems.forEach(item => {
    itemMap.set(item.uId, { ...item, children: [] });
  });
  
  // Second pass: build tree based on depth
  let lastParents: MenuItem[] = [];
  
  flatItems.forEach(item => {
    const menuItem = itemMap.get(item.uId)!;
    const depth = item.depth || 0;
    
    if (depth === 0) {
      rootItems.push(menuItem);
      lastParents = [menuItem];
    } else {
      const parent = lastParents[depth - 1];
      if (parent) {
        parent.children = parent.children || [];
        parent.children.push(menuItem);
        lastParents[depth] = menuItem;
      }
    }
  });
  
  return rootItems;
}
