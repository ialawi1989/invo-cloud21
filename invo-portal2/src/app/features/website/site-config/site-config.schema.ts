import { SettingGroup } from '../page-types/page-type.types';
import { SiteConfigSection } from './site-config.service';

/** Mirror of the backend's site-config schema shape. */
export interface SiteConfigSectionDef {
  key:         SiteConfigSection;
  title:       string;
  description: string;
  storedIn:    string;
  groups:      SettingGroup[];
}

export interface SiteConfigSchema {
  version:  string;
  sections: SiteConfigSectionDef[];
  external: Array<{ key: string; title: string; editor: string; reason: string }>;
}

/**
 * Bundled copy of the website-settings schema
 * (`InvoCloudBack/src/modules/website/siteConfig/siteConfig.schema.ts`).
 *
 * Same reasoning as the page-type fallback: the endpoint is additive, and a
 * settings screen with no fields reads as broken rather than degraded. The live
 * schema always wins.
 *
 * Only options a generic form can honestly edit live here. Colours, typography,
 * logos and banners are rich objects with a purpose-built editor in the builder
 * — the document carries them, this schema doesn't claim to edit them.
 */
export const FALLBACK_SITE_CONFIG_SCHEMA: SiteConfigSchema = {
  version: '1.0.0-fallback',

  sections: [
    {
      key: 'branding',
      title: 'General',
      description: 'How your site introduces itself.',
      storedIn: 'ThemeSettings',
      groups: [{
        key: 'identity',
        title: 'Identity',
        fields: [
          {
            key: 'websiteTitle', title: 'Website title', type: 'text',
            hint: 'Shown in the browser tab and used as a fallback for share cards.',
          },
        ],
      }],
    },
    {
      key: 'commerce',
      title: 'Commerce',
      description: 'How products and ordering behave across the site.',
      storedIn: 'ThemeSettings',
      groups: [
        {
          key: 'catalog',
          title: 'Catalog',
          fields: [
            {
              key: 'primaryListingSlug', title: 'Primary product page',
              type: 'select', optionsSource: 'listingPages',
              hint: 'Where "Shop"/"Order now" links land, and the listing used when a page needs one.',
            },
            {
              key: 'enforceServiceSelection', title: 'Ask for a service before browsing',
              type: 'boolean', default: false,
              hint: 'Delivery / pickup / dine-in is chosen before products are shown.',
            },
          ],
        },
        {
          key: 'delivery',
          title: 'Delivery',
          fields: [{
            key: 'deliveryAreaType', title: 'Delivery areas defined by', type: 'select',
            options: [
              { title: 'Zones',    value: 'zone' },
              { title: 'Distance', value: 'distance' },
              { title: 'Address',  value: 'address' },
            ],
          }],
        },
      ],
    },
    {
      key: 'contact',
      title: 'Contact',
      description: 'Details shown in the footer and on contact blocks.',
      storedIn: 'ThemeSettings',
      groups: [{
        key: 'reach',
        title: 'How customers reach you',
        fields: [{
          key: 'showContactInFooter', title: 'Show contact details in the footer',
          type: 'boolean', default: true,
        }],
      }],
    },
  ],

  external: [
    { key: 'layout', title: 'Theme & layout', editor: 'page-builder',   reason: 'Colours, typography, header and footer are edited in the builder, with a live preview.' },
    { key: 'seo',    title: 'SEO',            editor: 'settings/seo',   reason: 'Search appearance has its own screen.' },
    { key: 'blog',   title: 'Blog',           editor: 'settings/blog',  reason: 'Blog settings have their own screen.' },
  ],
};
