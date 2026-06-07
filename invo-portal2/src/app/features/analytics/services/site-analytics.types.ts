// ────────────────────────────────────────────────────────────────────
// Store-wide analytics — GA4 (traffic + e-commerce + realtime) and GSC
// (search) for the whole e-commerce site, NOT scoped to the blog.
//
// Backed by two new endpoints:
//   POST company/getSiteAnalytics   { from?, to? }  → SiteAnalytics
//   GET  company/getRealtimeAnalytics               → RealtimeAnalytics
//
// Everything past `integrations` is optional so the dashboard degrades
// gracefully (shows connect prompts / empty states) until GA4/GSC are
// configured and Google has data to report.
// ────────────────────────────────────────────────────────────────────

/** Query window for the report. */
export interface SiteAnalyticsParams {
  /** ISO date (YYYY-MM-DD), inclusive. */
  from?: string;
  /** ISO date (YYYY-MM-DD), inclusive. */
  to?:   string;
}

/** One day on a trend line. */
export interface SitePoint {
  date:       string;   // YYYY-MM-DD
  users:      number;
  sessions:   number;
  pageviews:  number;
}

/** Web-traffic section (GA4). */
export interface SiteTraffic {
  users:              number;
  newUsers?:          number;
  sessions:           number;
  pageviews:          number;
  /** 0..1 engagement rate. */
  engagementRate?:    number;
  /** Average engaged session duration, seconds. */
  avgSessionDuration?: number;
  series:             SitePoint[];
  topPages:           { path: string; title?: string; views: number; users?: number }[];
  sources:            { source: string; sessions: number }[];
  devices?:           { device: string; sessions: number }[];
}

/** E-commerce section (GA4 ecommerce events). */
export interface SiteEcommerce {
  revenue:         number;
  transactions:    number;
  /** 0..1 purchase conversion rate. */
  conversionRate?: number;
  avgOrderValue?:  number;
  itemsPurchased?: number;
  topProducts:     { name: string; itemsSold: number; revenue: number }[];
}

/** Google Search Console section. */
export interface SiteSearch {
  impressions: number;
  clicks:      number;
  ctr:         number;
  avgPosition: number;
  topQueries:  { query: string; impressions: number; clicks: number; ctr: number; position: number }[];
}

/** Full store-wide report. */
export interface SiteAnalytics {
  range?:        { from: string; to: string };
  integrations:  { ga4Enabled: boolean; gscEnabled: boolean };
  traffic?:      SiteTraffic | null;
  ecommerce?:    SiteEcommerce | null;
  search?:       SiteSearch | null;
  /** ISO currency code for revenue formatting (defaults to company currency). */
  currency?:     string;
}

/** Realtime snapshot (GA4 Realtime API). */
export interface RealtimeAnalytics {
  /** Active users right now. */
  activeUsers:  number;
  /** Per-minute active users for the last 30 minutes (oldest → newest). */
  last30min:    { minute: number; users: number }[];
  topPages?:    { path: string; activeUsers: number }[];
  byCountry?:   { country: string; activeUsers: number }[];
}
