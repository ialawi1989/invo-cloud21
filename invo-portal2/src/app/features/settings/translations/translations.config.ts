/**
 * Central config for the Translation Manager.
 *
 * The sidebar, the per-group child routes and the reusable grid are all
 * driven off this one array. To add a translatable entity you add an
 * entry here — declare its label, sidebar group, translatable fields and
 * where its data comes from — and (when the backend is ready) flip
 * `ready` to true with a `source`.
 *
 * Grouping mirrors Wix's Translation Manager layout: Site pages,
 * Business info, then store/Content Library collections.
 */

export interface TranslationFieldConfig {
  /** Field key on the record (title, body, name, …). */
  key: string;
  /** i18n key for the field label shown in the grid. */
  labelKey: string;
  /** Render the target editor as a multi-line textarea. */
  multiline?: boolean;
}

export type TranslationSourceKind = 'sample' | 'api' | 'ui';

export interface TranslationEntityConfig {
  /** Route slug + `entityId` passed to the data source. */
  id: string;
  /** i18n key for the entity's label (sidebar + grid title). */
  labelKey: string;
  /** i18n key for the sidebar group this entity sits under. */
  groupKey: string;
  /** i18n key for the grid subtitle / description. */
  descKey: string;
  /** Translatable fields (used for the grid, CSV columns, seeding). */
  fields: TranslationFieldConfig[];
  /** True once a backend (or the sample source) can serve this entity.
   *  False renders a disabled "coming soon" sidebar item + panel. */
  ready: boolean;
  /** Which data source backs the entity when `ready`. */
  source?: TranslationSourceKind;
  /** Endpoints for `source: 'api'` — bare relative paths for ApiService. */
  endpoints?: { list: string; save: string };
  /** For `source: 'ui'` — the i18n namespaces whose shipped English JSON
   *  supplies the editable keys. `''` = the base `i18n/<lang>.json`; a
   *  feature path (e.g. `'settings/translations'`) = that feature's file.
   *  Defaults to `['']` (base) when omitted. */
  uiNamespaces?: string[];
}

export const TRANSLATION_GROUP_ORDER: string[] = [
  'TRANSLATIONS.GROUPS.SITE',
  'TRANSLATIONS.GROUPS.INTERFACE',
  'TRANSLATIONS.GROUPS.BUSINESS',
  'TRANSLATIONS.GROUPS.STORE',
];

/** Shared endpoints — one generic backend serves every `api` entity;
 *  the entity id in the request body selects the table server-side. */
const TRANSLATION_ENDPOINTS = {
  list: 'translations/getTranslationList',
  save: 'translations/saveTranslation',
};

export const TRANSLATION_ENTITIES: TranslationEntityConfig[] = [
  // ── Site pages (page titles from WebSiteBuilder PageBuilder rows) ──
  {
    id: 'page-content',
    labelKey: 'TRANSLATIONS.ENTITIES.PAGE_CONTENT.LABEL',
    groupKey: 'TRANSLATIONS.GROUPS.SITE',
    descKey: 'TRANSLATIONS.ENTITIES.PAGE_CONTENT.DESC',
    ready: true,
    source: 'api',
    endpoints: TRANSLATION_ENDPOINTS,
    fields: [
      { key: 'pageName', labelKey: 'TRANSLATIONS.FIELDS.PAGE_NAME' },
    ],
  },

  // ── Site text (app UI strings; source = shipped i18n JSON, target =
  //    per-tenant override in theme settings) ─────────────────────────
  {
    id: 'ui-strings',
    labelKey: 'TRANSLATIONS.ENTITIES.UI_STRINGS.LABEL',
    groupKey: 'TRANSLATIONS.GROUPS.INTERFACE',
    descKey: 'TRANSLATIONS.ENTITIES.UI_STRINGS.DESC',
    ready: true,
    source: 'ui',
    // Base global chrome strings (COMMON, MENU, SIDEBAR, …). Add more
    // namespaces here to expose other features' text for overriding.
    uiNamespaces: [''],
    fields: [
      { key: 'value', labelKey: 'TRANSLATIONS.FIELDS.TEXT' },
    ],
  },

  // ── Business info (Companies.translation) ──────────────────────────
  {
    id: 'business-info',
    labelKey: 'TRANSLATIONS.ENTITIES.BUSINESS_INFO.LABEL',
    groupKey: 'TRANSLATIONS.GROUPS.BUSINESS',
    descKey: 'TRANSLATIONS.ENTITIES.BUSINESS_INFO.DESC',
    ready: true,
    source: 'api',
    endpoints: TRANSLATION_ENDPOINTS,
    fields: [
      { key: 'name', labelKey: 'TRANSLATIONS.FIELDS.NAME' },
    ],
  },

  // ── Store collections (inline JSONB translation columns) ───────────
  {
    id: 'categories',
    labelKey: 'TRANSLATIONS.ENTITIES.CATEGORIES.LABEL',
    groupKey: 'TRANSLATIONS.GROUPS.STORE',
    descKey: 'TRANSLATIONS.ENTITIES.CATEGORIES.DESC',
    ready: true,
    source: 'api',
    endpoints: TRANSLATION_ENDPOINTS,
    fields: [
      { key: 'name', labelKey: 'TRANSLATIONS.FIELDS.NAME' },
    ],
  },
  {
    id: 'products',
    labelKey: 'TRANSLATIONS.ENTITIES.PRODUCTS.LABEL',
    groupKey: 'TRANSLATIONS.GROUPS.STORE',
    descKey: 'TRANSLATIONS.ENTITIES.PRODUCTS.DESC',
    ready: true,
    source: 'api',
    endpoints: TRANSLATION_ENDPOINTS,
    fields: [
      { key: 'name', labelKey: 'TRANSLATIONS.FIELDS.NAME' },
    ],
  },
  {
    id: 'departments',
    labelKey: 'TRANSLATIONS.ENTITIES.DEPARTMENTS.LABEL',
    groupKey: 'TRANSLATIONS.GROUPS.STORE',
    descKey: 'TRANSLATIONS.ENTITIES.DEPARTMENTS.DESC',
    ready: true,
    source: 'api',
    endpoints: TRANSLATION_ENDPOINTS,
    fields: [
      { key: 'name', labelKey: 'TRANSLATIONS.FIELDS.NAME' },
    ],
  },
  {
    id: 'brands',
    labelKey: 'TRANSLATIONS.ENTITIES.BRANDS.LABEL',
    groupKey: 'TRANSLATIONS.GROUPS.STORE',
    descKey: 'TRANSLATIONS.ENTITIES.BRANDS.DESC',
    ready: true,
    source: 'api',
    endpoints: TRANSLATION_ENDPOINTS,
    fields: [
      { key: 'name', labelKey: 'TRANSLATIONS.FIELDS.NAME' },
    ],
  },
  {
    id: 'collections',
    labelKey: 'TRANSLATIONS.ENTITIES.COLLECTIONS.LABEL',
    groupKey: 'TRANSLATIONS.GROUPS.STORE',
    descKey: 'TRANSLATIONS.ENTITIES.COLLECTIONS.DESC',
    ready: true,
    source: 'api',
    endpoints: TRANSLATION_ENDPOINTS,
    fields: [
      { key: 'title', labelKey: 'TRANSLATIONS.FIELDS.TITLE' },
      { key: 'description', labelKey: 'TRANSLATIONS.FIELDS.DESCRIPTION', multiline: true },
    ],
  },
  {
    id: 'options',
    labelKey: 'TRANSLATIONS.ENTITIES.OPTIONS.LABEL',
    groupKey: 'TRANSLATIONS.GROUPS.STORE',
    descKey: 'TRANSLATIONS.ENTITIES.OPTIONS.DESC',
    ready: true,
    source: 'api',
    endpoints: TRANSLATION_ENDPOINTS,
    fields: [
      { key: 'name', labelKey: 'TRANSLATIONS.FIELDS.NAME' },
    ],
  },
  {
    id: 'option-groups',
    labelKey: 'TRANSLATIONS.ENTITIES.OPTION_GROUPS.LABEL',
    groupKey: 'TRANSLATIONS.GROUPS.STORE',
    descKey: 'TRANSLATIONS.ENTITIES.OPTION_GROUPS.DESC',
    ready: true,
    source: 'api',
    endpoints: TRANSLATION_ENDPOINTS,
    fields: [
      { key: 'name', labelKey: 'TRANSLATIONS.FIELDS.NAME' },
    ],
  },
  {
    id: 'dimensions',
    labelKey: 'TRANSLATIONS.ENTITIES.DIMENSIONS.LABEL',
    groupKey: 'TRANSLATIONS.GROUPS.STORE',
    descKey: 'TRANSLATIONS.ENTITIES.DIMENSIONS.DESC',
    ready: true,
    source: 'api',
    endpoints: TRANSLATION_ENDPOINTS,
    fields: [
      { key: 'name', labelKey: 'TRANSLATIONS.FIELDS.NAME' },
    ],
  },
  {
    id: 'matrix',
    labelKey: 'TRANSLATIONS.ENTITIES.MATRIX.LABEL',
    groupKey: 'TRANSLATIONS.GROUPS.STORE',
    descKey: 'TRANSLATIONS.ENTITIES.MATRIX.DESC',
    ready: true,
    source: 'api',
    endpoints: TRANSLATION_ENDPOINTS,
    fields: [
      { key: 'name', labelKey: 'TRANSLATIONS.FIELDS.NAME' },
    ],
  },
];

/** First entity — the empty-path redirect target. */
export const FIRST_TRANSLATION_ENTITY = TRANSLATION_ENTITIES[0].id;

export function findTranslationEntity(id: string): TranslationEntityConfig | undefined {
  return TRANSLATION_ENTITIES.find(e => e.id === id);
}

/** Entities bucketed by their sidebar group, in `TRANSLATION_GROUP_ORDER`. */
export function translationGroups(): { groupKey: string; entities: TranslationEntityConfig[] }[] {
  return TRANSLATION_GROUP_ORDER
    .map(groupKey => ({
      groupKey,
      entities: TRANSLATION_ENTITIES.filter(e => e.groupKey === groupKey),
    }))
    .filter(g => g.entities.length > 0);
}
