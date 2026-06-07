// ────────────────────────────────────────────────────────────────────
// Plugin — a per-company integration toggle (delivery aggregators,
// notification gateways, fiscal-compliance utilities, Content AI, …).
//
// Mirrors the legacy `Plugin` / `PluginSettings` wire shape closely
// enough that the existing `company/{getPlugins, getPlugin/:id,
// savePlugin}` endpoints round-trip unchanged. The front-end keeps a
// loose `settings` bag (provider credentials differ per plugin) plus a
// handful of typed known fields the forms bind to directly.
// ────────────────────────────────────────────────────────────────────

/** The four legacy groups plus the new `AI` group (Content AI). The
 *  list page renders sections in this order. */
export type PluginType =
  | 'Aggregator (Manual Entry)'
  | 'Aggregator'
  | 'Notifications'
  | 'Utilities'
  | 'Analytics'
  | 'AI';

/** Per-branch plugin override (MOIC credentials, GrubTech store/menu,
 *  FootfallCam site code, …). Only the fields the migrated forms touch
 *  are typed; everything else round-trips via the index signature. */
export interface BranchPlugin {
  branchId:   string;
  branchName: string;
  enable?:    boolean;

  // GrubTech
  storeId?:   string | null;
  menuId?:    string | null;
  isSynced?:  boolean;

  // FootfallCam
  siteCode?:  string;

  // MOIC
  moic_url?:           string;
  moic_username?:      string;
  moic_password?:      string;
  moic_resturant_id?:  string;

  [key: string]: unknown;
}

/** Loose settings bag — known credential/config keys are typed for
 *  editor convenience; unknown provider keys round-trip via the index
 *  signature so an unrelated save never drops another plugin's config. */
export interface PluginSettings {
  enable?: boolean;
  syncByBranch?: boolean;
  branches?: BranchPlugin[];

  // WhatsApp (Meta)
  Token?:   string;
  PhoneId?: string;

  // Infobip (WhatsApp + SMS)
  infobip_baseUrl?: string;
  infobip_apiKey?:  string;
  infobip_sender?:  string;

  // BareedSMS
  bareedsms_username?: string;
  bareedsms_password?: string;
  bareedsms_senderId?: string;

  // Email SMTP
  smtp_host?:     string;
  smtp_port?:     number;
  smtp_secure?:   boolean;
  smtp_user?:     string;
  smtp_password?: string;
  smtp_from?:     string;

  // WaSender
  wasender_token?:   string;
  wasender_baseUrl?: string;

  // MOIC
  moic_url?:          string;
  moic_username?:     string;
  moic_password?:     string;
  moic_resturant_id?: string;

  // FootfallCam
  userName?:        string;
  password?:        string;
  tokenExpiration?: string | null;

  // JordanFatoorah / Zatca
  taxName?:        string;
  clientId?:       string;
  secretKey?:      string;
  taxNumber?:      string;
  activityNumber?: string;

  // GrubTech
  services?: { Talabat?: string; Jahez?: string; ChatFood?: string; [k: string]: string | undefined };

  // Google Analytics (GA4)
  /** Measurement ID (G-XXXXXXX) — the gtag.js tag injected on the live site. */
  ga4_measurementId?: string;
  /** Numeric GA4 Property ID — used server-side by the GA Data API to read stats back. */
  ga4_propertyId?:    string;
  /** Service-account JSON key (secret) for the GA Data API. Never returned to the browser. */
  ga4_serviceKey?:    string;
  /** True when a service key is stored server-side (the backend's `<key>Set` flag). */
  ga4_serviceKeySet?: boolean;

  // Google Search Console (GSC)
  /** Property/site URL — either a URL-prefix (https://example.com/) or a domain property (sc-domain:example.com). */
  gsc_siteUrl?:       string;
  /** Service-account JSON key (secret) for the Search Console API. */
  gsc_serviceKey?:    string;
  /** True when a service key is stored server-side. */
  gsc_serviceKeySet?: boolean;

  [key: string]: unknown;
}

export interface Plugin {
  /** Empty string for plugins not yet persisted server-side. */
  id:         string;
  /** Canonical backend name — the join key with the registry. */
  pluginName: string;
  /** URL/route slug. */
  slug:       string;
  type:       PluginType | string;
  /** Short hint shown under the plugin name (e.g. "Sync at 1 AM"). */
  note?:      string;
  settings:   PluginSettings;
  logs?:      any[];
}

/** A grouped section for the list page. */
export interface PluginGroup {
  type:  PluginType;
  list:  Plugin[];
}

export function emptyPluginSettings(): PluginSettings {
  return { enable: false, branches: [] };
}
