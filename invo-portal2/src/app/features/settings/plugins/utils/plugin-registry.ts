import { PluginType } from '../services/plugin.types';

/**
 * Static catalogue of every plugin the portal knows about.
 *
 * The list page merges this registry with the server's saved plugins
 * (`company/getPlugins`) — the registry supplies the canonical name,
 * group, logo, slug and "is there a form?" flag; the server supplies
 * the saved `id` + `settings.enable` state. This mirrors the legacy
 * `initializePlugins()` seeding so a brand-new company still sees the
 * full catalogue with every plugin toggled off.
 *
 * Adding a plugin = one entry here + (optionally) a form component
 * wired into `plugins.routes.ts` under the matching `slug`.
 */
export interface PluginDef {
  /** Canonical backend `pluginName` — the join key with server data. */
  name:  string;
  /** Friendly label shown in the list. Defaults to `name` when omitted
   *  (used where the backend key isn't human-readable, e.g. GoogleAnalytics4). */
  displayName?: string;
  /** Route + URL slug (`/settings/plugins/:slug`). */
  slug:  string;
  type:  PluginType;
  /** Logo under `assets/images/plugins/`; empty → template placeholder. */
  logo:  string;
  /** One-line description shown under the name. i18n key. */
  descKey?: string;
  /** Short note shown under the name (sync cadence, etc.). i18n key. */
  noteKey?: string;
  /** Whether the row is clickable into a configuration form. Manual-
   *  entry aggregators (Ahlan/Talabat/Jahez) are toggle-only. */
  hasForm: boolean;
}

const LOGO = 'assets/images/plugins/';

export const PLUGIN_REGISTRY: PluginDef[] = [
  // ── Aggregators (manual entry) — toggle only, no form ──────────────
  { name: 'Ahlan',   slug: 'ahlan',   type: 'Aggregator (Manual Entry)', logo: LOGO + 'ahlan_logo.png',   descKey: 'PLUGINS.DESC.AHLAN',   hasForm: false },
  { name: 'Talabat', slug: 'talabat', type: 'Aggregator (Manual Entry)', logo: LOGO + 'talabat_logo.png', descKey: 'PLUGINS.DESC.TALABAT', hasForm: false },
  { name: 'Jahez',   slug: 'jahez',   type: 'Aggregator (Manual Entry)', logo: LOGO + 'jahez_logo.png',   descKey: 'PLUGINS.DESC.JAHEZ',   hasForm: false },

  // ── Aggregators (integrated) ───────────────────────────────────────
  { name: 'GrubTech', slug: 'grub-tech', type: 'Aggregator', logo: LOGO + 'GrubTech.png', descKey: 'PLUGINS.DESC.GRUBTECH', hasForm: true },

  // ── Notifications ──────────────────────────────────────────────────
  { name: 'Whatsapp Notifications', slug: 'whatsapp-notifications', type: 'Notifications', logo: LOGO + 'whatsapp_logo.png',          descKey: 'PLUGINS.DESC.WA_NOTIF',    hasForm: true },
  { name: 'Whatsapp Infobip',       slug: 'whatsapp-infobip',       type: 'Notifications', logo: LOGO + 'whatsapp_infobip_logo.png',  descKey: 'PLUGINS.DESC.WA_INFOBIP',  hasForm: true },
  { name: 'Whatsapp WaSender',      slug: 'whatsapp-wasender',      type: 'Notifications', logo: LOGO + 'whatsapp_wasender_logo.png', descKey: 'PLUGINS.DESC.WA_WASENDER', hasForm: true },
  { name: 'Sms Infobip',            slug: 'sms-infobip',            type: 'Notifications', logo: LOGO + 'sms_infobip_logo.png',       descKey: 'PLUGINS.DESC.SMS_INFOBIP', hasForm: true },
  { name: 'Sms BareedSMS',          slug: 'sms-bareedsms',          type: 'Notifications', logo: LOGO + 'sms_bareedsms_logo.png',     descKey: 'PLUGINS.DESC.SMS_BAREED',  hasForm: true },
  { name: 'Email SMTP',             slug: 'email-smtp',             type: 'Notifications', logo: LOGO + 'email_smtp_logo.png',        descKey: 'PLUGINS.DESC.SMTP',        hasForm: true },

  // ── Utilities ──────────────────────────────────────────────────────
  { name: 'MOIC',           slug: 'moic',           type: 'Utilities', logo: LOGO + 'moic_logo.png',           descKey: 'PLUGINS.DESC.MOIC',     noteKey: 'PLUGINS.NOTES.SYNC_1AM',  hasForm: true },
  { name: 'FootfallCam',    slug: 'footfallcam',    type: 'Utilities', logo: LOGO + 'footfallcam_logo.png',    descKey: 'PLUGINS.DESC.FOOTFALL', noteKey: 'PLUGINS.NOTES.SYNC_1AM',  hasForm: true },
  { name: 'Zatca',          slug: 'zatca',          type: 'Utilities', logo: LOGO + 'zatca.png',               descKey: 'PLUGINS.DESC.ZATCA',    noteKey: 'PLUGINS.NOTES.SYNC_6H',   hasForm: true },
  { name: 'JordanFatoorah', slug: 'jordanfatoorah', type: 'Utilities', logo: LOGO + 'JordanFatoorah_logo.png', descKey: 'PLUGINS.DESC.JOFOTARA', noteKey: 'PLUGINS.NOTES.SYNC_6H',   hasForm: true },

  // ── Analytics ──────────────────────────────────────────────────────
  // `name` is the backend join key (pluginName) — must match exactly.
  { name: 'GoogleAnalytics4',    displayName: 'Google Analytics 4',    slug: 'google-analytics-ga4',  type: 'Analytics', logo: LOGO + 'google_analytics_ga4_logo.svg',  descKey: 'PLUGINS.DESC.GA4', noteKey: 'PLUGINS.NOTES.SYNC_DAILY', hasForm: true },
  { name: 'GoogleSearchConsole', displayName: 'Google Search Console', slug: 'google-search-console', type: 'Analytics', logo: LOGO + 'google_search_console_logo.svg', descKey: 'PLUGINS.DESC.GSC', noteKey: 'PLUGINS.NOTES.SYNC_DAILY', hasForm: true },

  // ── AI ─────────────────────────────────────────────────────────────
  // Content AI — company-level config lives here (NOT a standalone page).
  // No logo asset yet; the list template renders the AI placeholder glyph.
  { name: 'ContentAI', slug: 'content-ai', type: 'AI', logo: '', descKey: 'PLUGINS.DESC.AI', hasForm: true },
];

/** Render order for the grouped list sections. */
export const PLUGIN_GROUP_ORDER: PluginType[] = [
  'Aggregator (Manual Entry)',
  'Aggregator',
  'Notifications',
  'Utilities',
  'Analytics',
  'AI',
];

const BY_NAME = new Map(PLUGIN_REGISTRY.map(d => [d.name.toLowerCase(), d]));
const BY_SLUG = new Map(PLUGIN_REGISTRY.map(d => [d.slug, d]));

export function findPluginByName(name: string): PluginDef | undefined {
  return BY_NAME.get((name ?? '').toLowerCase());
}
export function findPluginBySlug(slug: string): PluginDef | undefined {
  return BY_SLUG.get(slug);
}
