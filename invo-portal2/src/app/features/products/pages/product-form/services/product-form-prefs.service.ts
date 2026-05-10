import { Injectable, inject, signal } from '@angular/core';
import {
  EmployeeOptionsService,
  ProductFormPrefs,
  ProductFormPrefsByType,
  ProductFormRowLayout,
  ProductFormSectionPref,
} from '@core/layout/services/employee-options.service';

/**
 * Static descriptor for one product-form section. The `id`s match
 * the `@case` branches in the template and the keys the prefs modal
 * lists for the user. `required` sections can't be hidden — common
 * fields and branches are load-bearing for any saved product, so the
 * toggle is disabled in the modal.
 *
 * `i18nKey` is the translation key used for the modal label. Keeping
 * it on the catalog (instead of in the modal) means a new section
 * only needs editing in one place.
 *
 * `side` is the *default* column. The user can drag a section to
 * the other column in the modal — that override is persisted on
 * `ProductFormSectionPref.side` and applied per-type.
 */
export interface ProductFormSection {
  id:        string;
  side:      'main' | 'aside';
  i18nKey:   string;
  /** Default visibility when neither a per-type default
   *  (`defaultVisibleFor`) nor a user override exists. */
  defaultVisible: boolean;
  /** Per-type override on `defaultVisible`. Use this when a section
   *  should ship visible-by-default on some product types and
   *  hidden on others (e.g. Content tabs default-visible on
   *  inventory, default-hidden on service). */
  defaultVisibleFor?: { readonly [productType: string]: boolean };
  /** Universally required — forced visible on every product type,
   *  the user can't hide it. Use sparingly; prefer `requiredFor` so
   *  the section can stay optional for types where it doesn't apply. */
  required?:    boolean;
  /** Required *only* for these product types — forces visibility
   *  there and disables the modal toggle. On other types the
   *  section is optional and the user can hide it. Resolves with
   *  `required` (universal) via OR. */
  requiredFor?: readonly string[];
}

/** Layout descriptor handed to the template + modal. Each entry
 *  resolves to one rendered slot for the active product type. */
export interface ResolvedSection extends ProductFormSection {
  visible: boolean;
  order:   number;
  /** Effective side after merging the user override with the
   *  catalog default — the form's `mainSections()` /
   *  `asideSections()` filter on this. */
  effectiveSide: 'main' | 'aside';
  /** Row index this section belongs to. Defaults to 0 for legacy
   *  saves and brand-new sections. */
  row: number;
  /** Column within the row (`'left'` is always the first column;
   *  for `single`-layout rows it's the only column). */
  col: 'left' | 'right';
}

/** Row descriptor returned by `resolveRows()`. Each row has a
 *  layout (controls how the form renders its `grid-template-columns`)
 *  and two ordered section arrays — `right[]` is empty for
 *  single-column rows. */
export interface ResolvedRow {
  /** Row index = position in the rows[] array. The form template
   *  uses this for keyed `@for` tracking; the modal uses it as the
   *  identifier of the row's drop zones. */
  index:  number;
  layout: ProductFormRowLayout;
  left:   ResolvedSection[];
  right:  ResolvedSection[];
}

/** Wildcard key used when no per-type override exists. Layout
 *  defaults are derived from the catalog rather than this entry —
 *  the entry only exists if the user explicitly resets / saves at
 *  the global scope, which the current modal doesn't do. */
const ALL_TYPES = '*';

/**
 * ProductFormPrefsService
 * ───────────────────────
 * Owns the canonical catalog of product-form sections and merges it
 * with the user's saved overrides (`employeeOptions.productForm`).
 * Prefs are keyed per product type — each `productType` (`inventory`
 * / `batch` / `service` / `kit` / …) has its own layout because the
 * relevant sections differ wildly between types.
 *
 * The form template asks `effective('main', productType)` /
 * `effective('aside', productType)` for the ordered list to render;
 * the prefs modal asks `editable(productType)` for the same shape
 * to drive its drag lists.
 *
 * Saves go through `EmployeeOptionsService.patch()` so the per-user
 * record on the backend is updated atomically — prefs survive logout
 * / new browsers / different devices.
 */
@Injectable({ providedIn: 'root' })
export class ProductFormPrefsService {
  private opts = inject(EmployeeOptionsService);

  // Catalog order matches the legacy template — what the user sees
  // out of the box before any customisation. New sections go where
  // they make sense in the catalog; users with saved prefs see new
  // ones at the bottom of their order (per `effective()` below).
  static readonly CATALOG: readonly ProductFormSection[] = [
    // Main column
    { id: 'common-fields',     side: 'main',  i18nKey: 'PRODUCTS.SECTIONS.COMMON_FIELDS',     defaultVisible: true, required: true },
    // Content tabs: required for stock-bearing types (inventory /
    // batch / serialized / kit) where the option matrix actually
    // drives behaviour. Optional for menu / service / tailoring
    // products, where many companies don't use it.
    { id: 'tab-builder',       side: 'main',  i18nKey: 'PRODUCTS.SECTIONS.TAB_BUILDER',
      defaultVisible: true,
      defaultVisibleFor: { service: false, menuItem: false, menuSelection: false, tailoring: false, package: false },
      requiredFor: ['inventory', 'batch', 'serialized', 'kit'] },
    { id: 'pricing',           side: 'main',  i18nKey: 'PRODUCTS.SECTIONS.PRICING',           defaultVisible: true },
    { id: 'inventory',         side: 'main',  i18nKey: 'PRODUCTS.SECTIONS.INVENTORY',         defaultVisible: true },
    { id: 'suppliers',         side: 'main',  i18nKey: 'PRODUCTS.SECTIONS.SUPPLIERS',         defaultVisible: true },
    { id: 'price-by-team',     side: 'main',  i18nKey: 'PRODUCTS.SECTIONS.PRICE_BY_TEAM',     defaultVisible: true },
    { id: 'kit-details',       side: 'main',  i18nKey: 'PRODUCTS.SECTIONS.KIT_DETAILS',       defaultVisible: true },
    { id: 'kit-builder',       side: 'main',  i18nKey: 'PRODUCTS.SECTIONS.KIT_BUILDER',       defaultVisible: true },
    { id: 'recipe',            side: 'main',  i18nKey: 'PRODUCTS.SECTIONS.RECIPE',            defaultVisible: true },
    { id: 'options-tab',       side: 'main',  i18nKey: 'PRODUCTS.SECTIONS.OPTIONS_TAB',       defaultVisible: true },
    { id: 'menu-selection',    side: 'main',  i18nKey: 'PRODUCTS.SECTIONS.MENU_SELECTION',    defaultVisible: true },
    { id: 'package-builder',   side: 'main',  i18nKey: 'PRODUCTS.SECTIONS.PACKAGE_BUILDER',   defaultVisible: true },
    { id: 'custom-fields',     side: 'main',  i18nKey: 'PRODUCTS.SECTIONS.CUSTOM_FIELDS',     defaultVisible: true },
    { id: 'branches',          side: 'main',  i18nKey: 'PRODUCTS.SECTIONS.BRANCHES',          defaultVisible: true, required: true },
    // Attributes / allergens / nutrition are off by default — they're
    // niche sections (variant matrix, food regulations) most users
    // don't need on every product. The user can opt in via the
    // Advanced Options modal per product type.
    { id: 'product-attributes',side: 'main',  i18nKey: 'PRODUCTS.SECTIONS.ATTRIBUTES',        defaultVisible: false },
    { id: 'allergens',         side: 'main',  i18nKey: 'PRODUCTS.SECTIONS.ALLERGENS',         defaultVisible: false },
    { id: 'nutrition',         side: 'main',  i18nKey: 'PRODUCTS.SECTIONS.NUTRITION',         defaultVisible: false },
    // Side column
    { id: 'media',             side: 'aside', i18nKey: 'PRODUCTS.SECTIONS.MEDIA',             defaultVisible: true },
    { id: 'measurements',      side: 'aside', i18nKey: 'PRODUCTS.SECTIONS.MEASUREMENTS',      defaultVisible: true },
    { id: 'product-options',   side: 'aside', i18nKey: 'PRODUCTS.SECTIONS.PRODUCT_OPTIONS',   defaultVisible: true },
    { id: 'shipping-options',  side: 'aside', i18nKey: 'PRODUCTS.SECTIONS.SHIPPING_OPTIONS',  defaultVisible: true },
    { id: 'category-options',  side: 'aside', i18nKey: 'PRODUCTS.SECTIONS.CATEGORY_OPTIONS',  defaultVisible: true },
    { id: 'alias-barcodes',    side: 'aside', i18nKey: 'PRODUCTS.SECTIONS.ALIAS_BARCODES',    defaultVisible: true },
    { id: 'alt-product',       side: 'aside', i18nKey: 'PRODUCTS.SECTIONS.ALT_PRODUCT',       defaultVisible: true },
  ];

  /** Reactive copy of the user's saved overrides, keyed by product
   *  type. Empty until `load()` resolves. */
  readonly byType = signal<ProductFormPrefsByType>({});
  /** True once `load()` has resolved at least once. */
  readonly loaded = signal<boolean>(false);

  async load(): Promise<void> {
    const opts = await this.opts.get();
    this.byType.set(opts?.productForm ?? {});
    this.loaded.set(true);
  }

  /** Pull the saved prefs for a specific type, falling back to
   *  the wildcard key `*` (a global override the user could opt into
   *  later) and finally to an empty prefs blob (= catalog defaults). */
  prefsFor(productType: string): ProductFormPrefs {
    const map = this.byType();
    return map[productType] ?? map[ALL_TYPES] ?? { sections: [] };
  }

  /** Resolved layout list for one column under the active type.
   *  Legacy single-row API — kept for transitional callers.
   *  Prefer `resolveRows()` for the new multi-row layout. */
  effective(side: 'main' | 'aside', productType: string): ResolvedSection[] {
    return this.resolveAll(productType).filter(s => s.effectiveSide === side);
  }

  /** Editable list for the prefs modal — main + aside resolved for
   *  the active type. The modal's drag lists work off these arrays
   *  and persist back through `save()` when the user hits Apply.
   *  Legacy single-row shape; the row-aware modal uses
   *  `resolveRows()` directly. */
  editable(productType: string): { main: ResolvedSection[]; aside: ResolvedSection[] } {
    const all = this.resolveAll(productType);
    return {
      main:  all.filter(s => s.effectiveSide === 'main'),
      aside: all.filter(s => s.effectiveSide === 'aside'),
    };
  }

  /**
   * Multi-row layout — what the form renders and what the new modal
   * edits. Each `ResolvedRow` has a layout (`'2-1'` / `'1-1'` /
   * `'1-2'` / `'single'`) and two columns of resolved sections.
   * Sections sort by `order` *within* their column.
   *
   * Legacy saves (no `rows[]`, no `row`/`col` per section) collapse
   * into a single row 0 with the catalog's traditional 2:1 layout —
   * preserves the existing behaviour for users who never customise.
   *
   * Brand-new sections inherit row 0 + the catalog-derived column
   * so they show up in a sensible spot until the user moves them.
   */
  resolveRows(productType: string): ResolvedRow[] {
    return this.computeRows(productType, this.prefsFor(productType));
  }

  /** Same as `resolveRows()` but takes an explicit prefs blob,
   *  so callers can ask "what would the rows look like if these
   *  were the saved overrides?". The Reset button uses this with
   *  an empty blob to preview catalog defaults without persisting. */
  private computeRows(productType: string, prefs: ProductFormPrefs): ResolvedRow[] {
    const sections = this.resolveAllWith(productType, prefs);

    // Bucket sections by their row index.
    const bucket = new Map<number, ResolvedSection[]>();
    let maxRow = 0;
    for (const sec of sections) {
      maxRow = Math.max(maxRow, sec.row);
      const arr = bucket.get(sec.row) ?? [];
      arr.push(sec);
      bucket.set(sec.row, arr);
    }

    const rowsPref = prefs.rows ?? [];
    const out: ResolvedRow[] = [];
    for (let i = 0; i <= maxRow; i++) {
      const bag = bucket.get(i) ?? [];
      const left  = bag.filter(s => s.col === 'left' ).sort((a, b) => a.order - b.order);
      const right = bag.filter(s => s.col === 'right').sort((a, b) => a.order - b.order);
      out.push({
        index:  i,
        layout: rowsPref[i] ?? '2-1',
        left,
        right,
      });
    }
    // Drop trailing empty rows so the form doesn't render blank
    // strips when the user emptied a row but didn't delete it.
    while (out.length > 1 && out[out.length - 1].left.length === 0
                          && out[out.length - 1].right.length === 0) {
      out.pop();
    }
    return out;
  }

  /** Persist the new layout for `productType`. Re-emits `byType`
   *  synchronously so any open form re-renders before the network
   *  call resolves — matches the optimistic-update pattern used by
   *  the list-page column manager. */
  async save(productType: string, next: ProductFormPrefs): Promise<void> {
    const merged: ProductFormPrefsByType = { ...this.byType(), [productType]: next };
    this.byType.set(merged);
    await this.opts.patch({ productForm: merged });
  }

  /** Drop the user's overrides for a single type so the catalog
   *  defaults take over again. Other types' layouts stay intact. */
  async resetType(productType: string): Promise<void> {
    const next: ProductFormPrefsByType = { ...this.byType() };
    delete next[productType];
    this.byType.set(next);
    await this.opts.patch({ productForm: next });
  }

  /** Compute the row layout as if no user overrides existed for
   *  `productType` — used by the modal's Reset button to repopulate
   *  the working state without actually persisting (the user might
   *  still hit Cancel, in which case the saved prefs should stay
   *  untouched). Passes an empty prefs blob into the same row
   *  resolver `resolveRows` uses, so the result is identical to
   *  what a brand-new user would see. */
  defaultRows(productType: string): ResolvedRow[] {
    return this.computeRows(productType, { sections: [] });
  }

  /** Build a `ProductFormSectionPref[]` from a list of resolved
   *  sections — legacy single-row callers. Kept for the old modal
   *  path; the row-aware modal calls `toPersistedRows()`. */
  static toPersisted(main: ResolvedSection[], aside: ResolvedSection[]): ProductFormPrefs {
    const sections: ProductFormSectionPref[] = [];
    [...main, ...aside].forEach((sec) => {
      const def = ProductFormPrefsService.CATALOG.find(c => c.id === sec.id);
      const moved = !!def && def.side !== sec.effectiveSide;
      const entry: ProductFormSectionPref = {
        id:      sec.id,
        visible: sec.visible,
        order:   sec.order,
      };
      if (moved) entry.side = sec.effectiveSide;
      sections.push(entry);
    });
    return { sections };
  }

  /** Persist a multi-row layout. `order` is restamped within each
   *  column so the list reads cleanly on reload; `row` and `col`
   *  are written explicitly so future `effective()` calls don't
   *  have to fall back to the legacy `side` migration path. */
  static toPersistedRows(rows: ResolvedRow[]): ProductFormPrefs {
    const sections: ProductFormSectionPref[] = [];
    rows.forEach((row, ri) => {
      const writeCol = (list: ResolvedSection[], col: 'left' | 'right') => {
        list.forEach((sec, i) => {
          const entry: ProductFormSectionPref = {
            id:      sec.id,
            visible: sec.visible,
            order:   i,
            row:     ri,
            col,
          };
          // `side` is now derived from `col` on read, but we keep
          // it in sync so a downgrade to the legacy path still
          // shows the section in the right column.
          entry.side = col === 'left' ? 'main' : 'aside';
          sections.push(entry);
        });
      };
      writeCol(row.left,  'left');
      writeCol(row.right, 'right');
    });
    return {
      sections,
      rows: rows.map(r => r.layout),
    };
  }

  /** Walk the catalog + user overrides and produce a single sorted
   *  list of `ResolvedSection` for the active type. Used internally
   *  by `effective()` / `editable()`. */
  private resolveAll(productType: string): ResolvedSection[] {
    return this.resolveAllWith(productType, this.prefsFor(productType));
  }

  /** Same as `resolveAll()` but takes an explicit prefs blob —
   *  lets `computeRows()` preview catalog defaults without mutating
   *  the saved state. */
  private resolveAllWith(productType: string, prefs: ProductFormPrefs): ResolvedSection[] {
    const overrides = new Map(prefs.sections.map(s => [s.id, s]));

    // User-set order trumps catalog index; sections without a saved
    // order are pushed below user-customised ones (1000 + idx).
    const userOrdered = (prefs.sections ?? []).slice().sort((a, b) => a.order - b.order);
    const userIndex = new Map(userOrdered.map((s, i) => [s.id, i]));

    const out: ResolvedSection[] = ProductFormPrefsService.CATALOG.map((sec, idx) => {
      const o = overrides.get(sec.id);
      const userPos = userIndex.get(sec.id);
      const effectiveSide = (o?.side ?? sec.side) as 'main' | 'aside';

      // Per-type required: universal `required: true` OR the active
      // type appears in `requiredFor`. When required, the section is
      // forced visible regardless of user overrides — same shape as
      // the modal expects (the toggle there is disabled).
      const isRequired = !!sec.required ||
        (sec.requiredFor?.includes(productType) ?? false);

      // Per-type default visibility — fall back to the catalog
      // default when the active type isn't listed in
      // `defaultVisibleFor`.
      const typeDefault = sec.defaultVisibleFor?.[productType] ?? sec.defaultVisible;

      const visible = isRequired
        ? true
        : (o ? !!o.visible : typeDefault);

      // Row + column placement. Legacy saves carry only `side` —
      // map them onto row 0 with `left` for main and `right` for
      // aside. New saves write `row` and `col` explicitly.
      const row = o?.row ?? 0;
      const col: 'left' | 'right' =
        o?.col ?? (effectiveSide === 'main' ? 'left' : 'right');

      return {
        ...sec,
        required: isRequired,
        visible,
        order:    userPos != null ? userPos : (1000 + idx),
        effectiveSide,
        row,
        col,
      };
    });

    out.sort((a, b) => a.order - b.order);
    return out;
  }
}
