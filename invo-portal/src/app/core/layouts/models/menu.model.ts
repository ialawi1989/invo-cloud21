export interface MenuItem {
  id: number;
  label: string;
  icon?: string;
  link?: string;
  isTitle?: boolean;
  badge?: {
    variant: string;
    text: string;
  };
  subItems?: MenuItem[];
  expanded?: boolean;
}

export const MENU_ITEMS: MenuItem[] = [
  {
    id: 1,
    label: 'MENU',
    isTitle: true
  },
  {
    id: 2,
    label: 'Dashboard',
    icon: 'dashboard',
    link: '/dashboard'
  },
  {
    id: 3,
    label: 'Products',
    icon: 'inventory',
    subItems: [
      { id: 31, label: 'Product List', link: '/products' },
      { id: 32, label: 'Categories', link: '/products/categories' },
      { id: 33, label: 'Brands', link: '/products/brands' },
    ]
  },
  {
    id: 4,
    label: 'Orders',
    icon: 'shopping_cart',
    link: '/orders'
  },
  {
    id: 5,
    label: 'Customers',
    icon: 'people',
    link: '/customers'
  },
  {
    id: 6,
    label: 'Reports',
    icon: 'bar_chart',
    link: '/reports'
  },
  {
    id: 7,
    label: 'WEBSITE',
    isTitle: true
  },
  {
    id: 8,
    label: 'Page Builder',
    icon: 'web',
    link: '/builder'
  },
  {
    id: 9,
    label: 'Navigation',
    icon: 'menu',
    link: '/navigation'
  },
  {
    id: 10,
    label: 'Settings',
    icon: 'settings',
    subItems: [
      { id: 101, label: 'General', link: '/settings/general' },
      { id: 102, label: 'Payment Methods', link: '/settings/payments' },
      { id: 103, label: 'Shipping', link: '/settings/shipping' },
    ]
  }
];
