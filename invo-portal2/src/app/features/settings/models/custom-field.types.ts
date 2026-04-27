/**
 * Custom-field domain types.
 *
 * Mirrors the legacy schema (so the wire format and stored data stay
 * compatible with InvoCloudFront2 and the existing customizations on the
 * backend) but tightens the TypeScript types and trims a couple of
 * UI-state-only fields that don't need to round-trip.
 */

/**
 * Field input types we render in the manager and on entity forms.
 *
 * - **text/textarea** — short / long free-form strings.
 * - **number** — numeric input with min/max + display sub-type (currency, %).
 * - **select** — pick-from-list (single or multi).
 * - **date/datetime/time** — calendar / time-of-day pickers.
 * - **boolean** — yes/no toggle. Default value picks one side.
 * - **email/url/phone** — text variants with built-in semantic input
 *   types so mobile keyboards switch and browsers validate. Same
 *   `charLimit` knob as text.
 * - **color** — HEX color picker.
 */
export type CustomFieldType =
  | 'text'
  | 'textarea'
  | 'date'
  | 'datetime'
  | 'time'
  | 'number'
  | 'select'
  | 'boolean'
  | 'email'
  | 'url'
  | 'phone'
  | 'color';

/** Number sub-types — drives the formatting on rendered fields. */
export type NumberDisplay = 'integer' | 'decimal' | 'currency' | 'percentage';

/** Width preset for a field on the rendered form (3-col grid). */
export type GridTemplate = 'col-4' | 'col-6' | 'col-12';

/** One option entry on a `select` custom field. */
export interface CustomFieldOption {
  /** Display label — what the end-user sees in the dropdown. */
  label: string;
  /** Stored value — what gets persisted on the entity. Falls back to label when empty. */
  value: string;
}

/**
 * One custom field definition. Mirrors the legacy `CustomFields` shape so
 * existing data still loads. UI-only flags (open/active-tab) stay on this
 * object too — keeping them next to the data is simpler than maintaining
 * a parallel state map keyed by id.
 */
export interface CustomField {
  /** Stable id. Server-issued for saved fields, locally-generated `tmp_…` for unsaved. */
  id: string;

  /** Field input type. */
  type: CustomFieldType;

  /** Human-readable label rendered above the input. */
  name: string;

  /** Programmatic key (slug) — must be unique within the entity type. */
  abbr: string;

  /** Required toggle. */
  required: boolean;

  /** Optional default value (string/number/boolean depending on `type`). */
  defaultValue?: string | number | boolean | null;

  /** Width preset on the rendered form. */
  gridTemplate: GridTemplate;

  // ── Per-type validation knobs ─────────────────────────────────────────
  /** text / textarea — max chars. */
  charLimit?: number;
  /** number — min/max + display sub-type. */
  minNumber?: number;
  maxNumber?: number;
  numberDisplayType?: NumberDisplay;
  /** select — options + multi-select toggle. */
  customOptions?: CustomFieldOption[];
  selectMultiple?: boolean;
  clearable?: boolean;
  /** select — `null` is a valid stored value (renders an explicit "—"). */
  allowNull?: boolean;

  // ── Soft-delete + UI state ────────────────────────────────────────────
  /** True when the field has been soft-deleted; existing data still renders read-only. */
  isDeleted?: boolean;
  /** ISO timestamp of the soft-delete event. */
  deletedAt?: string | null;

  /** UI: which tab is currently active inside the accordion. Not persisted. */
  activeTab?: 'general' | 'validation' | 'options' | 'layout';
  /** UI: is the accordion expanded. Not persisted. */
  isOpened?: boolean;
}

/** Soft-delete metadata pushed into deleted records on first removal. */
export interface CustomFieldDeleted extends CustomField {
  isDeleted: true;
  deletedAt: string;
}

/**
 * One entity type that can carry custom fields. The route param uses
 * `type` (e.g. `/settings/custom-fields/product`); the manager renders
 * the `nameKey` translation as the breadcrumb title.
 */
export interface CustomFieldEntityType {
  /** URL slug + customization key (`product`, `branch`, …). */
  type: string;
  /** ngx-translate key under `SETTINGS.CUSTOM_FIELDS.ENTITIES.*`. */
  nameKey: string;
  /** Stable order in the list view. */
  index: number;
  /** Inline SVG `<path>` body for the card icon (no outer `<svg>` wrapper). */
  icon: string;
  /** Tailwind text-color class for the icon — keeps the cards visually varied. */
  color: string;
}

/**
 * The 9 entity types Invo supports custom fields on. Mirrors the legacy
 * `CUSTOM_FIELDS_TYPE` order so existing user mental models map across.
 */
export const CUSTOM_FIELD_ENTITY_TYPES: readonly CustomFieldEntityType[] = [
  {
    type: 'product',
    nameKey: 'SETTINGS.CUSTOM_FIELDS.ENTITIES.PRODUCT',
    index: 0,
    color: 'text-emerald-500',
    icon: '<path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/>',
  },
  {
    type: 'branch',
    nameKey: 'SETTINGS.CUSTOM_FIELDS.ENTITIES.BRANCH',
    index: 1,
    color: 'text-brand-600',
    icon: '<line x1="6" y1="3" x2="6" y2="15"/><circle cx="18" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M18 9a9 9 0 0 1-9 9"/>',
  },
  {
    type: 'customer',
    nameKey: 'SETTINGS.CUSTOM_FIELDS.ENTITIES.CUSTOMER',
    index: 2,
    color: 'text-violet-500',
    icon: '<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
  },
  {
    type: 'estimate',
    nameKey: 'SETTINGS.CUSTOM_FIELDS.ENTITIES.ESTIMATE',
    index: 3,
    color: 'text-amber-500',
    icon: '<path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>',
  },
  {
    type: 'invoice',
    nameKey: 'SETTINGS.CUSTOM_FIELDS.ENTITIES.INVOICE',
    index: 4,
    color: 'text-emerald-600',
    icon: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>',
  },
  {
    type: 'supplier',
    nameKey: 'SETTINGS.CUSTOM_FIELDS.ENTITIES.SUPPLIER',
    index: 5,
    color: 'text-orange-500',
    icon: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 11h-6"/><path d="M19 8v6"/>',
  },
  {
    type: 'purchaseOrder',
    nameKey: 'SETTINGS.CUSTOM_FIELDS.ENTITIES.PURCHASE_ORDER',
    index: 6,
    color: 'text-sky-500',
    icon: '<circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>',
  },
  {
    type: 'bill',
    nameKey: 'SETTINGS.CUSTOM_FIELDS.ENTITIES.BILL',
    index: 7,
    color: 'text-purple-500',
    icon: '<path d="M4 2v20l3-3 2.5 3L12 19l2.5 3L17 19l3 3V2z"/><line x1="9" y1="8" x2="15" y2="8"/><line x1="9" y1="12" x2="15" y2="12"/>',
  },
  {
    type: 'expense',
    nameKey: 'SETTINGS.CUSTOM_FIELDS.ENTITIES.EXPENSE',
    index: 8,
    color: 'text-rose-500',
    icon: '<line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>',
  },
];

/** Lookup helper — falls back to product when the slug is unknown. */
export function findEntityType(type: string): CustomFieldEntityType | null {
  return CUSTOM_FIELD_ENTITY_TYPES.find((e) => e.type === type) ?? null;
}

/** All field-type tokens — used to build the type dropdown. */
export const CUSTOM_FIELD_TYPES: readonly CustomFieldType[] = [
  'text', 'textarea', 'number', 'select', 'boolean',
  'email', 'url', 'phone', 'color',
  'date', 'datetime', 'time',
];

/** Field types whose value is stored as a string and capped by `charLimit`. */
export const TEXTUAL_TYPES: readonly CustomFieldType[] = [
  'text', 'textarea', 'email', 'url', 'phone',
];

/** Section groupings in the type picker — keep the grid scannable. */
export type FieldTypeSection = 'essentials' | 'contact' | 'time';

/** UI metadata for one field type — drives the "choose type" picker. */
export interface FieldTypeCard {
  type:    CustomFieldType;
  /** ngx-translate key for the card label (e.g. "Text"). */
  labelKey: string;
  /** ngx-translate key for the one-line description under the label. */
  descKey:  string;
  /** Inline SVG `<path>`/etc. body — no outer `<svg>` wrapper. */
  icon:     string;
  /** Section grouping in the picker. */
  section: FieldTypeSection;
}

/**
 * Metadata for the field-type picker modal. Kept as a flat array keyed
 * by `type` so adding a new field type only touches this list.
 */
export const FIELD_TYPE_CARDS: readonly FieldTypeCard[] = [
  {
    type: 'text',
    labelKey: 'SETTINGS.CUSTOM_FIELDS.TYPES.TEXT',
    descKey:  'SETTINGS.CUSTOM_FIELDS.TYPE_DESC.TEXT',
    section: 'essentials',
    icon: '<path d="M4 7V4h16v3"/><path d="M9 20h6"/><path d="M12 4v16"/>',
  },
  {
    type: 'textarea',
    labelKey: 'SETTINGS.CUSTOM_FIELDS.TYPES.TEXTAREA',
    descKey:  'SETTINGS.CUSTOM_FIELDS.TYPE_DESC.TEXTAREA',
    section: 'essentials',
    icon: '<line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="15" y2="18"/>',
  },
  {
    type: 'number',
    labelKey: 'SETTINGS.CUSTOM_FIELDS.TYPES.NUMBER',
    descKey:  'SETTINGS.CUSTOM_FIELDS.TYPE_DESC.NUMBER',
    section: 'essentials',
    icon: '<line x1="4" y1="9" x2="20" y2="9"/><line x1="4" y1="15" x2="20" y2="15"/><line x1="10" y1="3" x2="8" y2="21"/><line x1="16" y1="3" x2="14" y2="21"/>',
  },
  {
    type: 'select',
    labelKey: 'SETTINGS.CUSTOM_FIELDS.TYPES.SELECT',
    descKey:  'SETTINGS.CUSTOM_FIELDS.TYPE_DESC.SELECT',
    section: 'essentials',
    icon: '<polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>',
  },
  {
    type: 'boolean',
    labelKey: 'SETTINGS.CUSTOM_FIELDS.TYPES.BOOLEAN',
    descKey:  'SETTINGS.CUSTOM_FIELDS.TYPE_DESC.BOOLEAN',
    section: 'essentials',
    icon: '<rect x="3" y="7" width="18" height="10" rx="5"/><circle cx="16" cy="12" r="3" fill="currentColor"/>',
  },
  {
    type: 'email',
    labelKey: 'SETTINGS.CUSTOM_FIELDS.TYPES.EMAIL',
    descKey:  'SETTINGS.CUSTOM_FIELDS.TYPE_DESC.EMAIL',
    section: 'contact',
    icon: '<path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22 6 12 13 2 6"/>',
  },
  {
    type: 'url',
    labelKey: 'SETTINGS.CUSTOM_FIELDS.TYPES.URL',
    descKey:  'SETTINGS.CUSTOM_FIELDS.TYPE_DESC.URL',
    section: 'contact',
    icon: '<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>',
  },
  {
    type: 'phone',
    labelKey: 'SETTINGS.CUSTOM_FIELDS.TYPES.PHONE',
    descKey:  'SETTINGS.CUSTOM_FIELDS.TYPE_DESC.PHONE',
    section: 'contact',
    icon: '<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>',
  },
  {
    type: 'color',
    labelKey: 'SETTINGS.CUSTOM_FIELDS.TYPES.COLOR',
    descKey:  'SETTINGS.CUSTOM_FIELDS.TYPE_DESC.COLOR',
    section: 'essentials',
    icon: '<path d="M12 2C7 8 5 12 5 15a7 7 0 0 0 14 0c0-3-2-7-7-13z"/>',
  },
  {
    type: 'date',
    labelKey: 'SETTINGS.CUSTOM_FIELDS.TYPES.DATE',
    descKey:  'SETTINGS.CUSTOM_FIELDS.TYPE_DESC.DATE',
    section: 'time',
    icon: '<rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>',
  },
  {
    type: 'datetime',
    labelKey: 'SETTINGS.CUSTOM_FIELDS.TYPES.DATETIME',
    descKey:  'SETTINGS.CUSTOM_FIELDS.TYPE_DESC.DATETIME',
    section: 'time',
    icon: '<rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/><circle cx="16" cy="16" r="3"/><line x1="16" y1="14" x2="16" y2="16"/>',
  },
  {
    type: 'time',
    labelKey: 'SETTINGS.CUSTOM_FIELDS.TYPES.TIME',
    descKey:  'SETTINGS.CUSTOM_FIELDS.TYPE_DESC.TIME',
    section: 'time',
    icon: '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>',
  },
];

/** Look up a card by its type token. */
export function findFieldTypeCard(type: CustomFieldType): FieldTypeCard {
  return FIELD_TYPE_CARDS.find((c) => c.type === type) ?? FIELD_TYPE_CARDS[0];
}
