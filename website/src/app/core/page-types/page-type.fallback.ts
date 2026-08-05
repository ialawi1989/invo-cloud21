import { PageTypeManifest } from './page-type.types';

/**
 * Bundled copy of the manifest.
 *
 * The storefront must render during SSR and on a cold start even if the
 * manifest endpoint is slow, unmounted (it's a new additive route — see the
 * backend module's README) or unreachable. This copy is the floor: enough to
 * resolve every legacy slug to a page type and to know each setting's default.
 *
 * It is deliberately NOT the full field catalog — the storefront only needs
 * defaults and legacy mappings; the dashboard needs the titles and options to
 * build forms, and it fetches the live manifest.
 */
export const FALLBACK_MANIFEST: PageTypeManifest = {
  version: '1.0.0-fallback',

  pageTypes: [
    {
      id: 'content', title: 'Content page', description: '', multiple: true,
      settings: [{ key: 'page_settings', title: 'Page Settings', fields: [] }],
    },
    {
      id: 'product-list', title: 'Product listing', description: '', multiple: true,
      sources: ['menu', 'catalog', 'collection', 'search'],
      settings: [{
        key: 'page_settings', title: 'Page Settings',
        fields: [
          { key: 'product_style',       title: 'Product style',      type: 'select',  default: 'Style 1' },
          { key: 'product_image_size',  title: 'Product image size', type: 'select',  default: 'cover' },
          { key: 'default_view',        title: 'Default view',       type: 'select',  default: 'grid' },
          { key: 'sort_By',             title: 'Sort by',            type: 'select',  default: '' },
          { key: 'page_limit',          title: 'Products per page',  type: 'number',  default: 24 },
          { key: 'long_product_name',   title: 'Long product name',  type: 'boolean', default: false },
          { key: 'show_filter_by_tag',  title: 'Filter by tag',      type: 'boolean', default: false },
          { key: 'show_filter_by_brand', title: 'Filter by brand',   type: 'boolean', default: false },
          { key: 'show_pager_button',   title: 'Pager button',       type: 'boolean', default: false },
        ],
      }],
    },
    {
      id: 'product-detail', title: 'Product page', description: '', multiple: false,
      settings: [{
        key: 'page_settings', title: 'Page Settings',
        fields: [
          { key: 'product_image_size',   title: 'Product image size', type: 'select', default: 'cover' },
          { key: 'description_position', title: 'Description',        type: 'select', default: 'below' },
          { key: 'show_note_textbox',    title: 'Note textbox',       type: 'boolean', default: false },
        ],
      }],
    },
    { id: 'category-list', title: 'Categories', description: '', multiple: true, settings: [] },
    { id: 'cart',     title: 'Cart',     description: '', multiple: false, settings: [] },
    { id: 'checkout', title: 'Checkout', description: '', multiple: false, settings: [] },
    { id: 'account',  title: 'Account',  description: '', multiple: true,  settings: [] },
    { id: 'booking',  title: 'Booking',  description: '', multiple: true,  settings: [] },
  ],

  legacySlugs: {
    menu: 'product-list', shop: 'product-list', collections: 'product-list',
    search: 'product-list', products: 'product-list',
    product: 'product-detail', categories: 'category-list',
    cart: 'cart', checkout: 'checkout',
    'my-orders': 'account', order: 'account',
    'my-reservations': 'account', reservation: 'account', account: 'account',
    appointments: 'booking', 'table-reservation': 'booking',
  },

  legacySources: {
    menu:        { kind: 'menu', serviceFlow: true },
    shop:        { kind: 'catalog' },
    products:    { kind: 'catalog' },
    collections: { kind: 'collection' },
    search:      { kind: 'search' },
  },

  companySeeds: {},
};
