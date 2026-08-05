/**
 * Client-side mirror of the backend page-type manifest
 * (`InvoCloudBack/src/modules/website/pageTypes`).
 *
 * Keep these shapes in sync with that file — it is the contract both the
 * dashboard and this storefront render from.
 */

export type FieldType = 'boolean' | 'select' | 'multi-select' | 'image' | 'text' | 'number';

export interface FieldOption { title: string; value: string; }

export interface FieldCondition { key: string; value: string | number | boolean; }

export interface SettingField {
  key:        string;
  title:      string;
  type:       FieldType;
  default?:   string | number | boolean | string[];
  options?:   FieldOption[];
  condition?: FieldCondition;
  hint?:      string;
  /** Names a runtime option list the schema can't know (a tenant's listing
   *  pages, its branches). The client supplies it. */
  optionsSource?: string;
  /** A retired option: hidden from the editor, left untouched in storage, and
   *  named with what replaced it. Legacy settings don't have to survive as-is —
   *  their INTENT does, carried across by the migration. */
  deprecated?: { reason: string; replacedBy: string };
}

export interface SettingGroup { key: string; title: string; fields: SettingField[]; }

export type ListingSourceKind = 'menu' | 'catalog' | 'collection' | 'search';

export interface ListingSource {
  kind:         ListingSourceKind;
  menuId?:      string;
  collectionId?: string;
  categoryIds?: string[];
  /** Menu sources may force a service/branch selection before browsing. */
  serviceFlow?: boolean;
}

export interface PageTypeDef {
  id:          string;
  title:       string;
  description: string;
  multiple:    boolean;
  sources?:    ListingSourceKind[];
  settings:    SettingGroup[];

  /** Widgets a merchant may add around this page. `['*']` = everything (a
   *  content page is all canvas); a short list = decoration only, because a
   *  system page has a fixed core; empty/absent = settings only, no canvas. */
  allowedWidgets?: string[];

  /** Label for the immovable block standing in for the page's own output
   *  ("Product grid"), so the canvas shows where widgets sit relative to it. */
  coreBlockTitle?: string;
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
  /** Page-level statuses, offered for every type. */
  pageStatuses?: ReadonlyArray<{ value: string; title: string }>;
}

/** A page's lifecycle, kept OUT of `settings` because it decides whether the
 *  page exists for a visitor at all. */
export type PageStatus = 'published' | 'hidden' | 'redirect';

/** A page row resolved through the registry — what components consume. */
export interface ResolvedPage {
  slug:     string;
  name:     string;
  pageType: string;
  /** Settings with manifest defaults applied for anything unset. */
  settings: Record<string, any>;
  source:   ListingSource | null;
  /** Editor-built sections (content pages). */
  sections: any[];
  /** True when no page row existed for this slug. */
  missing:  boolean;
  /** published | hidden | redirect — applied before anything renders. */
  status:   PageStatus;
  /** Target slug when `status === 'redirect'`. */
  redirectTo: string;
}
