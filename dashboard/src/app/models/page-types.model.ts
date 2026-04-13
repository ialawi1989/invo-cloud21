// ============================================
// PAGE SYSTEM TYPES
// ============================================

// Page Types
export type PageType = 'static' | 'dynamic';

// Static Page from API
export interface StaticPage {
  id: string;
  name: string;
  slug: string;
  isHomePage: boolean;
  translation: Record<string, any>;
  template?: StaticPageTemplate;
}

export interface StaticPageTemplate {
  slug: string;
  isStatic: boolean;
  settings: StaticPageSettings;
  isHomePage: boolean;
  templateType: 'custom' | 'default';
}

// Static Page Settings (like Menu page)
export interface StaticPageSettings {
  sort_By?: string;
  page_limit?: string;
  default_view?: 'grid' | 'list';
  product_style?: string;
  redirect_to_shop?: boolean;
  show_page_button?: boolean;
  long_product_name?: boolean;
  show_pager_button?: boolean;
  show_filter_by_tag?: boolean;
  show_filter_by_tags?: boolean;
  subheader_settings?: SubheaderSettings;
  enforce_service_selection_on_menu_entry?: boolean;
  // Sidebar options
  sidebar?: SidebarSettings;
  // Top/Bottom components
  topComponents?: PageComponent[];
  bottomComponents?: PageComponent[];
}

// Subheader Settings
export interface SubheaderSettings {
  style: 'Image' | 'Color' | 'None';
  isParallax: boolean;
  showOverlay: boolean;
  defaultImage?: MediaItem;
  overlayColor: string;
  overlayOpacity: number;
  showOverlayPattern: boolean;
  title?: string;
  subtitle?: string;
  alignment?: 'left' | 'center' | 'right';
  height?: 'small' | 'medium' | 'large' | 'full';
}

// Media Item
export interface MediaItem {
  width: number;
  mediaId: string;
  defaultUrl: string;
}

// Sidebar Settings
export interface SidebarSettings {
  enabled: boolean;
  position: 'left' | 'right';
  width: number;
  components: SidebarComponent[];
}

export interface SidebarComponent {
  id: string;
  type: SidebarComponentType;
  settings: Record<string, any>;
}

export type SidebarComponentType = 
  | 'menu-list'
  | 'banner'
  | 'categories'
  | 'filters'
  | 'search'
  | 'custom-html';

// ============================================
// HEADER SETTINGS
// ============================================

export interface HeaderSettings {
  layout: HeaderLayout;
  style: 'transparent' | 'solid' | 'gradient';
  sticky: boolean;
  showTopBar: boolean;
  topBarContent: string;
  topBarBgColor: string;
  topBarTextColor: string;
  logo: MediaItem | null;
  logoPosition: 'left' | 'center';
  logoMaxHeight: number;
  menuPosition: 'left' | 'center' | 'right';
  showSearch: boolean;
  showCart: boolean;
  showAccount: boolean;
  showWishlist: boolean;
  backgroundColor: string;
  textColor: string;
  borderBottom: boolean;
  padding: 'small' | 'medium' | 'large';
}

export type HeaderLayout = 
  | 'logo-left-menu-right'
  | 'logo-center-menu-below'
  | 'logo-left-menu-center'
  | 'logo-center-menu-sides'
  | 'minimal';

export const HEADER_LAYOUTS: { value: HeaderLayout; label: string; icon: string }[] = [
  { value: 'logo-left-menu-right', label: 'Logo Left, Menu Right', icon: '◧' },
  { value: 'logo-center-menu-below', label: 'Logo Center, Menu Below', icon: '◫' },
  { value: 'logo-left-menu-center', label: 'Logo Left, Menu Center', icon: '◨' },
  { value: 'logo-center-menu-sides', label: 'Logo Center, Menu Sides', icon: '⬚' },
  { value: 'minimal', label: 'Minimal', icon: '▭' },
];

export const DEFAULT_HEADER_SETTINGS: HeaderSettings = {
  layout: 'logo-left-menu-right',
  style: 'solid',
  sticky: true,
  showTopBar: false,
  topBarContent: 'Free shipping on orders over $50',
  topBarBgColor: '#1a1a1a',
  topBarTextColor: '#ffffff',
  logo: null,
  logoPosition: 'left',
  logoMaxHeight: 48,
  menuPosition: 'right',
  showSearch: true,
  showCart: true,
  showAccount: true,
  showWishlist: false,
  backgroundColor: '#ffffff',
  textColor: '#1a1a1a',
  borderBottom: true,
  padding: 'medium',
};

// ============================================
// FOOTER SETTINGS & BUILDER
// ============================================

export interface FooterSettings {
  layout: FooterLayout;
  columns: FooterColumn[];
  backgroundColor: string;
  textColor: string;
  borderTop: boolean;
  showNewsletter: boolean;
  newsletterTitle: string;
  newsletterSubtitle: string;
  showSocialLinks: boolean;
  socialLinks: SocialLink[];
  showPaymentIcons: boolean;
  paymentIcons: string[];
  copyrightText: string;
  showBackToTop: boolean;
  padding: 'small' | 'medium' | 'large';
}

export type FooterLayout = 
  | '4-columns'
  | '3-columns'
  | '2-columns'
  | '1-column'
  | 'logo-left-links-right'
  | 'centered'
  | 'minimal';

export const FOOTER_LAYOUTS: { value: FooterLayout; label: string; columns: number; icon: string }[] = [
  { value: '4-columns', label: '4 Columns', columns: 4, icon: '▣▣▣▣' },
  { value: '3-columns', label: '3 Columns', columns: 3, icon: '▣▣▣' },
  { value: '2-columns', label: '2 Columns', columns: 2, icon: '▣▣' },
  { value: '1-column', label: '1 Column', columns: 1, icon: '▣' },
  { value: 'logo-left-links-right', label: 'Logo Left, Links Right', columns: 2, icon: '◧' },
  { value: 'centered', label: 'Centered', columns: 1, icon: '◯' },
  { value: 'minimal', label: 'Minimal', columns: 1, icon: '▭' },
];

export interface FooterColumn {
  id: string;
  title: string;
  width: number; // percentage or grid columns
  components: FooterColumnComponent[];
}

export interface FooterColumnComponent {
  id: string;
  type: FooterComponentType;
  settings: Record<string, any>;
}

export type FooterComponentType = 
  | 'logo'
  | 'text'
  | 'menu-links'
  | 'contact-info'
  | 'social-links'
  | 'newsletter'
  | 'custom-html'
  | 'image';

export interface SocialLink {
  platform: 'facebook' | 'instagram' | 'twitter' | 'youtube' | 'tiktok' | 'linkedin' | 'pinterest';
  url: string;
  enabled: boolean;
}

export const DEFAULT_FOOTER_SETTINGS: FooterSettings = {
  layout: '4-columns',
  columns: [
    {
      id: 'col-1',
      title: 'About',
      width: 25,
      components: [
        { id: 'logo-1', type: 'logo', settings: {} },
        { id: 'text-1', type: 'text', settings: { content: 'Your trusted online store for quality products.' } }
      ]
    },
    {
      id: 'col-2',
      title: 'Quick Links',
      width: 25,
      components: [
        { id: 'links-1', type: 'menu-links', settings: { links: ['Home', 'Shop', 'About', 'Contact'] } }
      ]
    },
    {
      id: 'col-3',
      title: 'Customer Service',
      width: 25,
      components: [
        { id: 'links-2', type: 'menu-links', settings: { links: ['FAQ', 'Shipping', 'Returns', 'Track Order'] } }
      ]
    },
    {
      id: 'col-4',
      title: 'Contact',
      width: 25,
      components: [
        { id: 'contact-1', type: 'contact-info', settings: { email: 'support@store.com', phone: '+1 234 567 890' } }
      ]
    }
  ],
  backgroundColor: '#1a1a1a',
  textColor: '#ffffff',
  borderTop: true,
  showNewsletter: true,
  newsletterTitle: 'Subscribe to our newsletter',
  newsletterSubtitle: 'Get the latest updates and offers',
  showSocialLinks: true,
  socialLinks: [
    { platform: 'facebook', url: '#', enabled: true },
    { platform: 'instagram', url: '#', enabled: true },
    { platform: 'twitter', url: '#', enabled: true },
  ],
  showPaymentIcons: true,
  paymentIcons: ['visa', 'mastercard', 'paypal', 'apple-pay'],
  copyrightText: '© 2024 Your Store. All rights reserved.',
  showBackToTop: true,
  padding: 'large',
};

// ============================================
// PAGE COMPONENT FOR DYNAMIC PAGES
// ============================================

export interface PageComponent {
  id: string;
  type: string;
  settings: Record<string, any>;
  order: number;
}

// ============================================
// STATIC PAGE SETTING SCHEMAS
// ============================================

export interface StaticPageSchema {
  slug: string;
  name: string;
  icon: string;
  settingsGroups: SettingsGroup[];
  supportsSidebar: boolean;
  supportsTopBottom: boolean;
  supportsSubheader: boolean;
}

export interface SettingsGroup {
  key: string;
  label: string;
  fields: SettingField[];
}

export interface SettingField {
  key: string;
  label: string;
  type: 'text' | 'textarea' | 'color' | 'number' | 'select' | 'toggle' | 'range' | 'image' | 'media';
  options?: { value: string; label: string }[];
  min?: number;
  max?: number;
  step?: number;
  description?: string;
}

// Static page schemas
export const STATIC_PAGE_SCHEMAS: StaticPageSchema[] = [
  {
    slug: 'menu',
    name: 'Menu',
    icon: 'menu',
    supportsSidebar: true,
    supportsTopBottom: true,
    supportsSubheader: true,
    settingsGroups: [
      {
        key: 'display',
        label: 'Display Settings',
        fields: [
          { key: 'default_view', label: 'Default View', type: 'select', options: [
            { value: 'grid', label: 'Grid' },
            { value: 'list', label: 'List' }
          ]},
          { key: 'product_style', label: 'Product Style', type: 'select', options: [
            { value: 'Style 1', label: 'Style 1' },
            { value: 'Style 2', label: 'Style 2' },
            { value: 'Style 3', label: 'Style 3' }
          ]},
          { key: 'page_limit', label: 'Products per Page', type: 'select', options: [
            { value: '12', label: '12' },
            { value: '24', label: '24' },
            { value: '36', label: '36' },
            { value: '48', label: '48' }
          ]},
          { key: 'sort_By', label: 'Default Sort', type: 'select', options: [
            { value: 'default', label: 'Default' },
            { value: 'price_asc', label: 'Price: Low to High' },
            { value: 'price_desc', label: 'Price: High to Low' },
            { value: 'name_asc', label: 'Name: A-Z' },
            { value: 'newest', label: 'Newest' }
          ]},
        ]
      },
      {
        key: 'features',
        label: 'Features',
        fields: [
          { key: 'show_filter_by_tag', label: 'Show Tag Filter', type: 'toggle' },
          { key: 'show_pager_button', label: 'Show Pagination', type: 'toggle' },
          { key: 'show_page_button', label: 'Show Page Button', type: 'toggle' },
          { key: 'long_product_name', label: 'Show Full Product Name', type: 'toggle' },
          { key: 'redirect_to_shop', label: 'Redirect to Shop on Click', type: 'toggle' },
        ]
      }
    ]
  },
  {
    slug: 'shop',
    name: 'Shop',
    icon: 'shopping-bag',
    supportsSidebar: true,
    supportsTopBottom: true,
    supportsSubheader: true,
    settingsGroups: [
      {
        key: 'display',
        label: 'Display Settings',
        fields: [
          { key: 'default_view', label: 'Default View', type: 'select', options: [
            { value: 'grid', label: 'Grid' },
            { value: 'list', label: 'List' }
          ]},
          { key: 'columns', label: 'Grid Columns', type: 'select', options: [
            { value: '3', label: '3 Columns' },
            { value: '4', label: '4 Columns' },
            { value: '5', label: '5 Columns' }
          ]},
          { key: 'page_limit', label: 'Products per Page', type: 'select', options: [
            { value: '12', label: '12' },
            { value: '24', label: '24' },
            { value: '36', label: '36' }
          ]},
        ]
      },
      {
        key: 'filters',
        label: 'Filters',
        fields: [
          { key: 'show_categories', label: 'Show Categories', type: 'toggle' },
          { key: 'show_price_filter', label: 'Show Price Filter', type: 'toggle' },
          { key: 'show_sort', label: 'Show Sort Options', type: 'toggle' },
        ]
      }
    ]
  },
  {
    slug: 'product',
    name: 'Product',
    icon: 'package',
    supportsSidebar: false,
    supportsTopBottom: true,
    supportsSubheader: false,
    settingsGroups: [
      {
        key: 'layout',
        label: 'Layout',
        fields: [
          { key: 'image_position', label: 'Image Position', type: 'select', options: [
            { value: 'left', label: 'Left' },
            { value: 'right', label: 'Right' }
          ]},
          { key: 'gallery_style', label: 'Gallery Style', type: 'select', options: [
            { value: 'thumbnails', label: 'Thumbnails' },
            { value: 'dots', label: 'Dots' },
            { value: 'carousel', label: 'Carousel' }
          ]},
        ]
      },
      {
        key: 'sections',
        label: 'Sections',
        fields: [
          { key: 'show_reviews', label: 'Show Reviews', type: 'toggle' },
          { key: 'show_related', label: 'Show Related Products', type: 'toggle' },
          { key: 'show_recently_viewed', label: 'Show Recently Viewed', type: 'toggle' },
        ]
      }
    ]
  },
  {
    slug: 'cart',
    name: 'Shopping Cart',
    icon: 'shopping-cart',
    supportsSidebar: false,
    supportsTopBottom: true,
    supportsSubheader: true,
    settingsGroups: [
      {
        key: 'display',
        label: 'Display',
        fields: [
          { key: 'show_thumbnails', label: 'Show Product Images', type: 'toggle' },
          { key: 'show_quantity_selector', label: 'Show Quantity Selector', type: 'toggle' },
          { key: 'show_subtotal', label: 'Show Subtotal', type: 'toggle' },
        ]
      },
      {
        key: 'features',
        label: 'Features',
        fields: [
          { key: 'show_promo_code', label: 'Show Promo Code Input', type: 'toggle' },
          { key: 'show_shipping_estimate', label: 'Show Shipping Estimate', type: 'toggle' },
          { key: 'show_continue_shopping', label: 'Show Continue Shopping', type: 'toggle' },
        ]
      }
    ]
  },
  {
    slug: 'checkout',
    name: 'Checkout',
    icon: 'credit-card',
    supportsSidebar: false,
    supportsTopBottom: false,
    supportsSubheader: false,
    settingsGroups: [
      {
        key: 'layout',
        label: 'Layout',
        fields: [
          { key: 'style', label: 'Checkout Style', type: 'select', options: [
            { value: 'one-page', label: 'One Page' },
            { value: 'multi-step', label: 'Multi Step' }
          ]},
        ]
      },
      {
        key: 'fields',
        label: 'Form Fields',
        fields: [
          { key: 'require_phone', label: 'Require Phone', type: 'toggle' },
          { key: 'show_notes', label: 'Show Order Notes', type: 'toggle' },
          { key: 'show_gift_option', label: 'Show Gift Option', type: 'toggle' },
        ]
      }
    ]
  },
  {
    slug: 'collections',
    name: 'Collections',
    icon: 'grid',
    supportsSidebar: true,
    supportsTopBottom: true,
    supportsSubheader: true,
    settingsGroups: [
      {
        key: 'display',
        label: 'Display',
        fields: [
          { key: 'columns', label: 'Columns', type: 'select', options: [
            { value: '2', label: '2 Columns' },
            { value: '3', label: '3 Columns' },
            { value: '4', label: '4 Columns' }
          ]},
          { key: 'card_style', label: 'Card Style', type: 'select', options: [
            { value: 'minimal', label: 'Minimal' },
            { value: 'bordered', label: 'Bordered' },
            { value: 'shadow', label: 'Shadow' }
          ]},
        ]
      }
    ]
  },
  {
    slug: 'categories',
    name: 'Categories',
    icon: 'folder',
    supportsSidebar: true,
    supportsTopBottom: true,
    supportsSubheader: true,
    settingsGroups: [
      {
        key: 'display',
        label: 'Display',
        fields: [
          { key: 'layout', label: 'Layout', type: 'select', options: [
            { value: 'grid', label: 'Grid' },
            { value: 'list', label: 'List' },
            { value: 'masonry', label: 'Masonry' }
          ]},
          { key: 'show_count', label: 'Show Product Count', type: 'toggle' },
          { key: 'show_description', label: 'Show Description', type: 'toggle' },
        ]
      }
    ]
  }
];

// Helper to get schema by slug
export function getStaticPageSchema(slug: string): StaticPageSchema | undefined {
  return STATIC_PAGE_SCHEMAS.find(s => s.slug === slug);
}

// Subheader presets
export const SUBHEADER_PRESETS = [
  { name: 'None', style: 'None' as const },
  { name: 'Simple Color', style: 'Color' as const },
  { name: 'Image Background', style: 'Image' as const },
  { name: 'Parallax Image', style: 'Image' as const, isParallax: true },
];

export const DEFAULT_SUBHEADER_SETTINGS: SubheaderSettings = {
  style: 'Image',
  isParallax: false,
  showOverlay: true,
  overlayColor: '#000000',
  overlayOpacity: 40,
  showOverlayPattern: false,
  title: '',
  subtitle: '',
  alignment: 'center',
  height: 'medium',
};
