/**
 * Dashboard mirror of the backend page-type manifest
 * (`InvoCloudBack/src/modules/website/pageTypes`).
 *
 * The dashboard used to own this knowledge as a 1,421-line hardcoded catalog
 * keyed by page slug, duplicated again in the storefront. It now renders forms
 * from the manifest instead, so a new setting is added in one place.
 *
 * Keep these shapes identical to the storefront's copy in
 * `website/src/app/core/page-types/page-type.types.ts`.
 */

export type FieldType = 'boolean' | 'select' | 'multi-select' | 'image' | 'text' | 'number';

export interface FieldOption { title: string; value: string; }

export interface FieldCondition { key: string; value: string | number | boolean; }

export interface SettingField {
  /** Storage key inside `template.settings` — never rename; existing rows
   *  depend on it. */
  key:        string;
  title:      string;
  type:       FieldType;
  default?:   string | number | boolean | string[];
  options?:   FieldOption[];
  condition?: FieldCondition;
  hint?:      string;
}

export interface SettingGroup { key: string; title: string; fields: SettingField[]; }

export type ListingSourceKind = 'menu' | 'catalog' | 'collection' | 'search';

export interface ListingSource {
  kind:          ListingSourceKind;
  menuId?:       string;
  collectionId?: string;
  categoryIds?:  string[];
  serviceFlow?:  boolean;
}

export interface PageTypeDef {
  id:          string;
  title:       string;
  description: string;
  /** Whether a company may create more than one page of this type — the reason
   *  a merchant can run both a menu and a shop. */
  multiple:    boolean;
  sources?:    ListingSourceKind[];
  settings:    SettingGroup[];
}

export interface PageTypeManifest {
  version:       string;
  pageTypes:     PageTypeDef[];
  legacySlugs:   Record<string, string>;
  legacySources: Record<string, ListingSource>;
  /** `template.templateType` → page type. The old dashboard's own field for
   *  the page kind; survives a URL rename, so it outranks the slug. */
  legacyTemplateTypes?:   Record<string, string>;
  legacyTemplateSources?: Record<string, ListingSource>;
  companySeeds:  Record<string, Array<{ slug: string; pageType: string; source?: ListingSource; name: string }>>;
}
