import { Injectable, computed, inject, signal } from '@angular/core';

import { MenuBuilderService } from '../services/menu-builder.service';
import {
  COLOR_SCHEMES,
  MAX_PAGES,
  type Menu,
  type MenuSection,
  type MenuSectionColor,
  type MenuSectionProduct,
} from '../services/menu-builder.types';
import { fits, firstEmptySlot, hasProduct, onPage, planMove, planStep, slotsUsed, tileKey, type MovePlan } from '../utils/menu-layout';
import { validateMenuForm, type MenuFormErrors } from '../utils/menu-form-validation';

const tempId = (): string => 'tmp_' + Math.random().toString(36).slice(2, 10);

/** Identity of a menu / section / tile: the server id, or the local one given to things added in this session. */
export const idOf = (e: any): string => e?.id ?? e?.__tempId ?? '';

export const emptyMenu = (): Menu => ({
  id: null, name: '', branchIds: [], priceLabelId: '', startAt: '00:00:00', endAt: '23:59:00', availableOnline: true,
  sections: [], index: 0,
});

/** What the picker / search hands over. */
export interface ProductInput { id: string; name: string; defaultImage?: string; color?: string; price?: number | null }

export type PlaceResult =
  | { ok: true; tile: MenuSectionProduct }
  | { ok: false; reason: 'duplicate' | 'full' | 'occupied' | 'no-section' };

export type SaveOutcome = 'saved' | 'invalid' | 'failed';

/**
 * The single source of truth of the menu form: the menu, which section / page is open, dirty, saving, and every edit.
 * Provided by the page component (one store per open form). Only this store and the page talk to the service;
 * the presentational components get signals' values as inputs and report back with outputs.
 */
@Injectable()
export class MenuBuilderStore {
  private service = inject(MenuBuilderService);

  // ── State ──
  readonly menu = signal<Menu>(emptyMenu());
  private readonly snapshot = signal(JSON.stringify(emptyMenu()));
  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly selectedSectionId = signal<string | null>(null);
  readonly selectedPage = signal(1);
  /** Set by the first save attempt: from then on the field errors are shown. */
  readonly submitted = signal(false);
  private readonly serverErrors = signal<MenuFormErrors>({});

  // ── Derived ──
  readonly isDirty = computed(() => JSON.stringify(this.menu()) !== this.snapshot());
  readonly sections = computed(() => this.menu().sections);
  readonly selectedSection = computed<MenuSection | null>(() => {
    const id = this.selectedSectionId();
    return id ? this.menu().sections.find((s) => idOf(s) === id) ?? null : null;
  });
  readonly pageProducts = computed<MenuSectionProduct[]>(() => {
    const s = this.selectedSection();
    return s ? onPage(s.products, this.selectedPage()) : [];
  });
  /** "{used} of 36 slots used" for the open page. */
  readonly slotsUsed = computed(() => slotsUsed(this.selectedSection()?.products ?? [], this.selectedPage()));
  /** Sections with no products: they do not show on the POS. */
  readonly emptySectionCount = computed(() => this.menu().sections.filter((s) => s.products.length === 0).length);
  readonly canAddPage = computed(() => {
    const s = this.selectedSection();
    return !!s && s.pages < MAX_PAGES && s.products.some((p) => p.page === s.pages);
  });
  /** Every problem with the form as it is now. */
  private readonly allErrors = computed(() => validateMenuForm(this.menu(), idOf));
  /** What the UI shows: section-name errors right away, the rest after the first save attempt, plus whatever the server said. */
  readonly errors = computed<MenuFormErrors>(() => {
    const all = this.allErrors();
    const shown: MenuFormErrors = {};
    for (const [k, v] of Object.entries(all)) if (this.submitted() || k.startsWith('section:')) shown[k] = v;
    return { ...shown, ...this.serverErrors() };
  });

  // ── Loading ──
  async load(id: string | null): Promise<void> {
    this.loading.set(true);
    try {
      const loaded = id ? await this.service.getMenu(id) : null;
      this.setMenu(loaded ?? emptyMenu());
    } finally {
      this.loading.set(false);
    }
  }

  /** Replace everything with `m` (a load, or the server's copy after a save). Selection is kept by position. */
  private setMenu(m: Menu, keepSelectionAt?: number): void {
    this.stamp(m);
    this.menu.set(m);
    const pick = keepSelectionAt != null ? m.sections[Math.min(keepSelectionAt, m.sections.length - 1)] : m.sections[0];
    this.selectedSectionId.set(pick ? idOf(pick) : null);
    this.selectedPage.set(1);
    this.snapshot.set(JSON.stringify(m));
    this.serverErrors.set({});
    this.submitted.set(false);
  }

  private stamp(m: Menu): void {
    for (const s of m.sections) {
      if (!s.id && !(s as any).__tempId) (s as any).__tempId = tempId();
      for (const p of s.products) if (!p.id && !(p as any).__tempId) (p as any).__tempId = tempId();
    }
  }

  // ── Menu fields ──
  patch<K extends keyof Menu>(key: K, value: Menu[K]): void {
    this.menu.update((m) => ({ ...m, [key]: value }));
    if (this.serverErrors()[key as string]) this.serverErrors.update(({ [key as string]: _, ...rest }) => rest);
  }

  // ── Sections ──
  /** Adds "New section" at the end, selects it, and returns its id (so the caller can focus its name). */
  addSection(name: string): string {
    const section: MenuSection = {
      id: null, name, translation: {}, image: '', pages: 1, products: [],
      color: { ...COLOR_SCHEMES[this.menu().sections.length % COLOR_SCHEMES.length] },
    };
    (section as any).__tempId = tempId();
    this.menu.update((m) => ({ ...m, sections: [...m.sections, section] }));
    this.select(idOf(section));
    return idOf(section);
  }

  select(id: string): void {
    this.selectedSectionId.set(id);
    this.selectedPage.set(1);
  }

  private patchSection(id: string, change: Partial<MenuSection>): void {
    this.menu.update((m) => ({ ...m, sections: m.sections.map((s) => (idOf(s) === id ? { ...s, ...change } : s)) }));
  }

  renameSection(id: string, name: string): void { this.patchSection(id, { name }); }
  setSectionColor(id: string, color: MenuSectionColor): void { this.patchSection(id, { color }); }

  /** Drag-and-drop / keyboard reorder. The new order is what gets saved (each section's `index`). */
  moveSection(from: number, to: number): void {
    const list = [...this.menu().sections];
    if (from === to || from < 0 || to < 0 || from >= list.length || to >= list.length) return;
    const [item] = list.splice(from, 1);
    list.splice(to, 0, item);
    this.menu.update((m) => ({ ...m, sections: list }));
  }

  /** Clone a section (name + " (copy)", products without server ids). Client-side only: it is saved with the menu. */
  duplicateSection(id: string): string | null {
    const src = this.menu().sections.find((s) => idOf(s) === id);
    if (!src) return null;
    const names = new Set(this.menu().sections.map((s) => s.name.trim().toLowerCase()));
    let name = `${src.name} (copy)`;
    for (let n = 2; names.has(name.toLowerCase()); n++) name = `${src.name} (copy ${n})`;
    const copy: MenuSection = {
      ...src, id: null, name, translation: { ...src.translation }, color: { ...src.color },
      products: src.products.map((p) => { const c = { ...p, id: null } as MenuSectionProduct; (c as any).__tempId = tempId(); return c; }),
    };
    (copy as any).__tempId = tempId();
    const at = this.menu().sections.findIndex((s) => idOf(s) === id) + 1;
    this.menu.update((m) => ({ ...m, sections: [...m.sections.slice(0, at), copy, ...m.sections.slice(at)] }));
    this.select(idOf(copy));
    return idOf(copy);
  }

  /** Removes a section and returns it (with its position) so the caller can offer Undo. */
  deleteSection(id: string): { section: MenuSection; index: number } | null {
    const list = this.menu().sections;
    const index = list.findIndex((s) => idOf(s) === id);
    if (index < 0) return null;
    const section = list[index];
    const rest = list.filter((s) => idOf(s) !== id);
    this.menu.update((m) => ({ ...m, sections: rest }));
    if (this.selectedSectionId() === id) {
      const next = rest[Math.min(index, rest.length - 1)];
      this.selectedSectionId.set(next ? idOf(next) : null);
      this.selectedPage.set(1);
    }
    return { section, index };
  }

  restoreSection(section: MenuSection, index: number): void {
    this.menu.update((m) => {
      const list = [...m.sections];
      list.splice(Math.min(index, list.length), 0, section);
      return { ...m, sections: list };
    });
    this.select(idOf(section));
  }

  // ── Pages ──
  selectPage(page: number): void { this.selectedPage.set(page); }

  addPage(): void {
    const s = this.selectedSection();
    if (!s || !this.canAddPage()) return;
    this.patchSection(idOf(s), { pages: s.pages + 1 });
    this.selectedPage.set(s.pages + 1);
  }

  /** Drops a page and the products on it; pages above shift down. Returns what was removed (for Undo / the confirm text). */
  removePage(page: number): MenuSectionProduct[] {
    const s = this.selectedSection();
    if (!s || page <= 1 || page > s.pages) return [];
    const removed = s.products.filter((p) => p.page === page);
    const products = s.products.filter((p) => p.page !== page).map((p) => (p.page > page ? { ...p, page: p.page - 1 } : p));
    this.patchSection(idOf(s), { pages: Math.max(1, s.pages - 1), products });
    if (this.selectedPage() >= page) this.selectedPage.set(Math.max(1, this.selectedPage() - 1));
    return removed;
  }

  // ── Products ──
  /**
   * Put a product on the open page of the open section, at `at` or (when omitted) in the first empty slot.
   * Refused, with the reason, when the product is already on the page, the spot is taken, or the page is full.
   */
  placeProduct(prod: ProductInput, at?: { x: number; y: number }): PlaceResult {
    const s = this.selectedSection();
    if (!s) return { ok: false, reason: 'no-section' };
    const page = this.selectedPage();
    if (hasProduct(s.products, page, prod.id)) return { ok: false, reason: 'duplicate' };
    const spot = at ?? firstEmptySlot(s.products, page);
    if (!spot) return { ok: false, reason: 'full' };
    if (!fits(s.products, page, { x: spot.x, y: spot.y, cols: 1, rows: 1 })) return { ok: false, reason: at ? 'occupied' : 'full' };
    const tile: MenuSectionProduct = {
      id: null, productId: prod.id, productName: prod.name, page, x: spot.x, y: spot.y, cols: 1, rows: 1,
      color: prod.color || s.color.borderColor, defaultImage: prod.defaultImage ?? '', price: prod.price ?? null, mediaId: null,
    };
    (tile as any).__tempId = tempId();
    this.patchSection(idOf(s), { products: [...s.products, tile] });
    return { ok: true, tile };
  }

  /** Place several (the picker hands over a list), each in the next free slot from `at`. Returns how many fit. */
  placeMany(list: ProductInput[], at?: { x: number; y: number }): { placed: number; skipped: number } {
    let placed = 0;
    let skipped = 0;
    let cursor = at;
    for (const p of list) {
      const s = this.selectedSection();
      // The first one goes where the user clicked; the rest flow on from the first empty slot.
      const r = this.placeProduct(p, cursor && s && fits(s.products, this.selectedPage(), { ...cursor, cols: 1, rows: 1 }) ? cursor : undefined);
      cursor = undefined;
      if (r.ok) placed++; else skipped++;
    }
    return { placed, skipped };
  }

  private applyPlan(plan: MovePlan): MovePlan {
    const s = this.selectedSection();
    if (!s || plan.kind === 'blocked') return plan;
    const by = new Map(plan.changes.map((c) => [c.key, c] as const));
    this.patchSection(idOf(s), {
      products: s.products.map((p) => { const c = by.get(tileKey(p)); return c ? { ...p, x: c.x, y: c.y } : p; }),
    });
    return plan;
  }

  /** Drag a tile to a cell: a move onto an empty cell, a swap with a same-size tile, otherwise nothing happens. */
  moveProduct(key: string, to: { x: number; y: number }): MovePlan {
    const s = this.selectedSection();
    return s ? this.applyPlan(planMove(s.products, this.selectedPage(), key, to)) : { kind: 'blocked' };
  }

  /** The keyboard "Move to...": one cell in a direction. */
  stepProduct(key: string, dir: 'up' | 'down' | 'left' | 'right'): MovePlan {
    const s = this.selectedSection();
    return s ? this.applyPlan(planStep(s.products, this.selectedPage(), key, dir)) : { kind: 'blocked' };
  }

  /** Change a tile's footprint (1 or 2 cells each way). Refused when it would overlap another tile or leave the grid. */
  resizeProduct(key: string, cols: number, rows: number): boolean {
    const s = this.selectedSection();
    const tile = s?.products.find((p) => tileKey(p) === key);
    if (!s || !tile) return false;
    if (!fits(s.products, tile.page, { x: tile.x, y: tile.y, cols, rows }, key)) return false;
    this.patchSection(idOf(s), { products: s.products.map((p) => (tileKey(p) === key ? { ...p, cols, rows } : p)) });
    return true;
  }

  removeProduct(key: string): MenuSectionProduct | null {
    const s = this.selectedSection();
    const tile = s?.products.find((p) => tileKey(p) === key);
    if (!s || !tile) return null;
    this.patchSection(idOf(s), { products: s.products.filter((p) => tileKey(p) !== key) });
    return tile;
  }

  /** Undo of a removal: back into its slot, or the first empty one if something else has taken it since. */
  restoreProduct(tile: MenuSectionProduct): boolean {
    const s = this.selectedSection();
    if (!s) return false;
    const spot = fits(s.products, tile.page, tile) ? { x: tile.x, y: tile.y } : firstEmptySlot(s.products, tile.page, tile.cols, tile.rows);
    if (!spot) return false;
    this.patchSection(idOf(s), { products: [...s.products, { ...tile, x: spot.x, y: spot.y }] });
    return true;
  }

  setProductColor(key: string, color: string): void {
    const s = this.selectedSection();
    if (!s) return;
    this.patchSection(idOf(s), { products: s.products.map((p) => (tileKey(p) === key ? { ...p, color } : p)) });
  }

  /** Bulk colour edit from the "Product colors" dialog. */
  setProductColors(edits: Array<{ id: string; color: string }>): void {
    const s = this.selectedSection();
    if (!s || edits.length === 0) return;
    const map = new Map(edits.map((e) => [e.id, e.color] as const));
    this.patchSection(idOf(s), { products: s.products.map((p) => { const c = map.get(tileKey(p)); return c == null ? p : { ...p, color: c }; }) });
  }

  // ── Save ──
  /**
   * One request for the whole menu. Returns:
   *  'invalid' the form has errors (shown; `errors()` says which), nothing was sent;
   *  'saved' | 'failed'.
   */
  async save(): Promise<SaveOutcome> {
    this.submitted.set(true);
    if (Object.keys(this.allErrors()).length > 0) return 'invalid';
    this.saving.set(true);
    try {
      const keepAt = Math.max(0, this.menu().sections.findIndex((s) => idOf(s) === this.selectedSectionId()));
      const res = await this.service.save(this.menu());
      if (!res.success) {
        this.serverErrors.set({ _general: res.message || '' });
        return 'failed';
      }
      if (res.data) { this.setMenu(res.data, keepAt); return 'saved'; }
      // The server did not send the menu back: load it, so new sections and products get their real ids.
      const id = res.id ?? this.menu().id;
      const fresh = id ? await this.service.getMenu(id) : null;
      if (fresh) this.setMenu(fresh, keepAt);
      else this.snapshot.set(JSON.stringify(this.menu()));
      return 'saved';
    } finally {
      this.saving.set(false);
    }
  }
}
