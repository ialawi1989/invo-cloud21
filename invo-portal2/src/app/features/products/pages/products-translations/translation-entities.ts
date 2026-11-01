import { TranslationEntity } from '../../services/bulk-translation.service';

/** One translatable field of an entity — edited through the shared TranslationModalComponent. */
export interface TranslationFieldDef {
  /** Key inside the row's `translation` object. */
  key: 'name' | 'description' | 'displayName';
  /** i18n key for the column header / modal label. */
  labelKey: string;
  /** Multi-line textarea in the modal (descriptions). */
  multiline?: boolean;
}

export interface TranslationEntityDef {
  entity: TranslationEntity;
  /** i18n key for the tab label. */
  labelKey: string;
  /** Property holding the source (primary-language) text on a list row. */
  sourceKey: 'name' | 'title';
  fields: TranslationFieldDef[];
}

const NAME: TranslationFieldDef = { key: 'name', labelKey: 'PRODUCTS.TRANSLATION_PAGE.COL_NAME' };

/**
 * The tabs of the Translation page, in the legacy order. Brands/categories/etc.
 * only expose Name (the legacy grids did too); products also carry a description
 * and the booking/storefront display-name override.
 */
export const TRANSLATION_ENTITIES: TranslationEntityDef[] = [
  {
    entity: 'products',
    labelKey: 'PRODUCTS.TITLE',
    sourceKey: 'name',
    fields: [
      NAME,
      { key: 'description', labelKey: 'PRODUCTS.TRANSLATION_PAGE.COL_DESCRIPTION', multiline: true },
      { key: 'displayName', labelKey: 'PRODUCTS.TRANSLATION_PAGE.COL_DISPLAY_NAME' },
    ],
  },
  { entity: 'matrixes',      labelKey: 'PRODUCTS.TRANSLATION_PAGE.TAB_MATRIXES', sourceKey: 'name',  fields: [NAME] },
  { entity: 'departments',   labelKey: 'PRODUCTS.DEPARTMENTS.TITLE',             sourceKey: 'name',  fields: [NAME] },
  { entity: 'categories',    labelKey: 'PRODUCTS.CATEGORIES.TITLE',              sourceKey: 'name',  fields: [NAME] },
  { entity: 'option-groups', labelKey: 'PRODUCTS.OPTION_GROUPS.TITLE',           sourceKey: 'title', fields: [NAME] },
  { entity: 'options',       labelKey: 'PRODUCTS.OPTIONS.TITLE',                 sourceKey: 'name',  fields: [NAME] },
  { entity: 'brands',        labelKey: 'PRODUCTS.BRANDS.TITLE',                  sourceKey: 'name',  fields: [NAME] },
];

export const DEFAULT_TRANSLATION_ENTITY: TranslationEntity = 'products';

export function findTranslationEntity(value: string | null | undefined): TranslationEntityDef {
  return TRANSLATION_ENTITIES.find((e) => e.entity === value) ?? TRANSLATION_ENTITIES[0];
}
