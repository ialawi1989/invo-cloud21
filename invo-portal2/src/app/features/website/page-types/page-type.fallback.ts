import { PageTypeManifest, SettingField } from './page-type.types';

/**
 * Bundled copy of the backend manifest
 * (`InvoCloudBack/src/modules/website/pageTypes/pageTypes.manifest.ts`).
 *
 * The manifest endpoint is additive and may not be mounted on a given
 * deployment — without this the Pages screen would come up with no type names,
 * an empty "Add page" menu and no setting defaults, which looks broken rather
 * than degraded. Keep the two in step; the live manifest always wins.
 */

const subheader: SettingField = { key: 'subheader_settings', title: 'Subheader settings', type: 'image' };

const productStyle: SettingField = {
  key: 'product_style', title: 'Product style', type: 'select', default: 'Style 1',
  options: [1, 2, 3, 4, 5].map(n => ({ title: `Style ${n}`, value: `Style ${n}` })),
};

const productImageSize: SettingField = {
  key: 'product_image_size', title: 'Product image size', type: 'select', default: 'cover',
  options: [
    { title: '- Select -', value: '' },
    { title: 'Contain',    value: 'contain' },
    { title: 'Cover',      value: 'cover' },
  ],
};

export const FALLBACK_MANIFEST: PageTypeManifest = {
  version: '1.0.0-fallback',

  pageTypes: [
    {
      id: 'content', title: 'Content page', multiple: true,
      allowedWidgets: ['*'],
      description: 'Free-form page built from sections in the editor.',
      settings: [{ key: 'page_settings', title: 'Page Settings', fields: [subheader] }],
    },
    {
      id: 'product-list', title: 'Product listing', multiple: true,
      allowedWidgets: ['hero', 'banner', 'text', 'rich-text', 'image', 'spacer', 'buttons', 'faq', 'features'],
      coreBlockTitle: 'Product grid',
      description:
        'Shows products from a chosen source. One type covers what used to be ' +
        'three separate pages (menu, shop, collections).',
      sources: ['menu', 'catalog', 'collection', 'search'],
      settings: [{
        key: 'page_settings', title: 'Page Settings',
        fields: [
          subheader,
          productStyle,
          productImageSize,
          {
            key: 'default_view', title: 'Default view', type: 'select', default: 'grid',
            options: [{ title: 'Grid', value: 'grid' }, { title: 'List', value: 'list' }],
          },
          {
            key: 'sort_By', title: 'Sort by', type: 'select', default: '',
            options: [
              { title: '- Select -',       value: '' },
              { title: 'Name',             value: 'name' },
              { title: 'Price low → high', value: 'priceAsc' },
              { title: 'Price high → low', value: 'priceDesc' },
              { title: 'Newest',           value: 'newest' },
            ],
          },
          { key: 'page_limit',         title: 'Products per page',       type: 'number',  default: 24 },
          { key: 'long_product_name',  title: 'Allow long product name', type: 'boolean', default: false },
          { key: 'show_filter_by_tag', title: 'Show filter by tag',      type: 'boolean', default: false },
          {
            key: 'show_filter_by_brand', title: 'Show filter by brand', type: 'boolean', default: false,
            condition: { key: 'source.kind', value: 'catalog' },
          },
          {
            key: 'show_pager_button', title: 'Show pager button', type: 'boolean', default: false,
            condition: { key: 'source.kind', value: 'menu' },
          },
          {
            key: 'enforce_service_selection_on_menu_entry',
            title: 'Require service selection on entry', type: 'boolean', default: false,
            condition: { key: 'source.kind', value: 'menu' },
          },
          {
            key: 'redirect_to_shop', title: 'Redirect to shop', type: 'boolean', default: false,
            condition: { key: 'source.kind', value: 'menu' },
          },
        ],
      }],
    },
    {
      id: 'product-detail', title: 'Product page', multiple: false,
      allowedWidgets: ['banner', 'text', 'rich-text', 'spacer', 'features', 'faq'],
      coreBlockTitle: 'Product details',
      description: 'A single product. One canonical URL per product.',
      settings: [{
        key: 'page_settings', title: 'Page Settings',
        fields: [
          subheader,
          productImageSize,
          { key: 'auto_display_product_image_in_banner', title: 'Use product image in banner', type: 'boolean', default: false },
          {
            key: 'description_position', title: 'Description position', type: 'select', default: 'below',
            options: [
              { title: 'Below the details', value: 'below' },
              { title: 'Beside the image',  value: 'beside' },
            ],
          },
          { key: 'disable_out_of_stock_matrix_dimensions', title: 'Disable out-of-stock variants', type: 'boolean', default: false },
          { key: 'show_note_textbox', title: 'Show note textbox', type: 'boolean', default: false },
        ],
      }],
    },
    {
      id: 'category-list', title: 'Categories', multiple: true,
      allowedWidgets: ['hero', 'banner', 'text', 'rich-text', 'spacer'],
      coreBlockTitle: 'Category grid',
      description: 'Grid of product categories.',
      settings: [{ key: 'page_settings', title: 'Page Settings', fields: [subheader, productImageSize] }],
    },
    {
      id: 'cart', title: 'Cart', multiple: false,
      allowedWidgets: ['banner', 'text', 'spacer'],
      coreBlockTitle: 'Cart', description: 'The shopping cart.',
      settings: [{ key: 'page_settings', title: 'Page Settings', fields: [subheader] }],
    },
    {
      id: 'checkout', title: 'Checkout', multiple: false,
      allowedWidgets: ['banner', 'text', 'spacer'],
      coreBlockTitle: 'Checkout steps', description: 'Order placement.',
      settings: [{
        key: 'page_settings', title: 'Page Settings',
        fields: [
          subheader,
          { key: 'enable_schedule_order', title: 'Enable schedule order', type: 'boolean', default: false },
          {
            key: 'disable_immediate_order', title: 'Disable immediate order', type: 'boolean', default: false,
            condition: { key: 'enable_schedule_order', value: true },
          },
          {
            key: 'start_day_for_schedule_order', title: 'Start day for schedule order',
            type: 'select', default: '0',
            options: [
              { title: 'Today',        value: '0' },
              { title: 'Tomorrow',     value: '1' },
              { title: 'After 2 days', value: '2' },
              { title: 'After 3 days', value: '3' },
            ],
            condition: { key: 'enable_schedule_order', value: true },
          },
          {
            key: 'disable_pay_later_for', title: 'Disable pay later', type: 'multi-select', default: [],
            options: [
              { title: 'Delivery', value: 'delivery' },
              { title: 'Shipping', value: 'shipping' },
              { title: 'PickUp',   value: 'pickup' },
              { title: 'DineIn',   value: 'dinein' },
            ],
          },
          { key: 'disable_delivery', title: 'Disable delivery', type: 'boolean', default: false },
          { key: 'disable_pickup',   title: 'Disable pickup',   type: 'boolean', default: false },
        ],
      }],
    },
    {
      id: 'system', title: 'System page', multiple: false,
      allowedWidgets: ['banner', 'text', 'spacer'],
      coreBlockTitle: 'Page content',
      description: 'A built-in storefront page configured through settings.',
      settings: [{ key: 'page_settings', title: 'Page Settings', fields: [subheader] }],
    },
    {
      id: 'account', title: 'Account', multiple: true,
      allowedWidgets: ['banner', 'text', 'spacer'],
      coreBlockTitle: 'Account',
      description: 'Orders, reservations and profile.',
      settings: [{ key: 'page_settings', title: 'Page Settings', fields: [subheader] }],
    },
    {
      id: 'booking', title: 'Booking', multiple: true,
      allowedWidgets: ['hero', 'banner', 'text', 'rich-text', 'spacer', 'faq'],
      coreBlockTitle: 'Booking form',
      description: 'Appointments or table reservations.',
      settings: [{
        key: 'page_settings', title: 'Page Settings',
        fields: [
          subheader,
          {
            key: 'booking_kind', title: 'What is booked', type: 'select', default: 'table',
            options: [
              { title: 'A table',        value: 'table' },
              { title: 'An appointment', value: 'appointment' },
            ],
          },
        ],
      }],
    },
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

  legacyTemplateTypes: {
    menu: 'product-list', shop: 'product-list', collection: 'product-list',
    'view-product': 'product-detail',
    appointment: 'booking', 'table-reservation': 'booking',
    // NOTE: 'custom' and 'blog' removed 2026-08-06. This map OUTRANKS the slug,
    // and 'custom' is a generic marker rather than a kind — 22 of 43 page rows
    // carry it across SIX different types, so mapping it to 'content' mistyped
    // 21 of 22 unmigrated rows (an unmigrated `shop` rendered as a content
    // canvas). Keep in step with LEGACY_TEMPLATE_TYPES in the backend manifest
    // and with the 1783800000000 backfill migration.
  },

  legacyTemplateSources: {
    menu:       { kind: 'menu', serviceFlow: true },
    shop:       { kind: 'catalog' },
    collection: { kind: 'collection' },
  },

  companySeeds: {},
};
