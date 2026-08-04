import { Injectable, computed, signal } from '@angular/core';
import { Block, BlockType } from '../core/types/block.types';
import { Orientation, PageMargins, PageSetup, PaperSize, ReportTemplate, Section, TenantTheme } from '../core/types/template.types';
import { FilterMap } from '../core/types/binding.types';
import { BindingEngine } from '../core/binding/binding-engine';
import { blockRegistry } from '../core/registry/block-registry';
import { computePageDimensions } from '../core/layout/dimensions';
import { ScaleFactors, scaleTemplateGeometry } from '../core/layout/scale-template';

/**
 * One alignment guide line surfaced by the drag-snapping logic. `kind` is
 * the line's orientation; `position` is the page-X (vertical guide) or
 * page-Y (horizontal guide) in mm. `from`/`to` are the perpendicular range
 * the line spans — typically the top of the topmost involved block to the
 * bottom of the bottommost (for vertical guides) so the rendered line
 * visibly connects the two aligned edges.
 */
export interface AlignGuide {
  kind: 'v' | 'h';
  position: number;
  from: number;
  to: number;
}

/**
 * Single source of truth for the designer. All UI components subscribe to the
 * signals exposed here. Mutations are routed through methods so the history
 * service can record diffs cleanly.
 */
@Injectable({ providedIn: 'root' })
export class DesignerStateService {
  private readonly _template = signal<ReportTemplate | null>(null);
  private readonly _selectedIds = signal<Set<string>>(new Set());
  private readonly _activeSectionId = signal<string | null>(null);
  private readonly _zoom = signal(1);
  /** Host-provided custom filters merged with the built-ins. Plug-in
   *  consumers pass these via `<invo-report-designer [extraFilters]>` —
   *  typically to swap `currency` for a tenant-aware implementation. */
  private readonly _extraFilters = signal<FilterMap>({});
  /** Alignment guides published by the block currently being dragged.
   *  Each guide is one snap line the canvas overlay renders; the dragger
   *  writes them on every move and clears them on pointerup. Position +
   *  range are in mm relative to the page's inside-margin frame. */
  private readonly _alignGuides = signal<AlignGuide[]>([]);

  readonly template = this._template.asReadonly();
  readonly selectedIds = this._selectedIds.asReadonly();
  readonly zoom = this._zoom.asReadonly();
  readonly activeSectionId = this._activeSectionId.asReadonly();
  readonly alignGuides = this._alignGuides.asReadonly();

  /** Replace the visible alignment guides — the dragger calls this on
   *  every move, then `setAlignGuides([])` on pointerup. Pulled out as a
   *  method so the canvas-block doesn't have to import the writeable
   *  signal directly. */
  setAlignGuides(guides: AlignGuide[]): void {
    this._alignGuides.set(guides);
  }

  /**
   * Shared binding engine — recomputes only when `extraFilters` changes.
   * Every UI consumer (canvas-block, property-panel, binding-dialog) and
   * the export renderers read THIS engine so a plug-in's `currency`
   * override applies everywhere consistently. Stored as a computed so
   * `extraFilters` updates flow through without forcing every component
   * to subscribe separately.
   */
  readonly bindingEngine = computed<BindingEngine>(() => new BindingEngine(this._extraFilters()));

  /** Replace the active filter overrides. Pass `{}` to clear. */
  setExtraFilters(filters: FilterMap | undefined): void {
    this._extraFilters.set(filters ?? {});
  }

  /** Override the template's sample data without rebuilding the template
   *  itself — used when the host passes real data via `[data]` Input. */
  setSampleData(data: Record<string, unknown> | undefined): void {
    const t = this._template();
    if (!t) return;
    this._template.set({ ...t, sampleData: data });
  }

  readonly activeSection = computed<Section | null>(() => {
    const t = this._template();
    const id = this._activeSectionId();
    if (!t) return null;
    return t.sections.find((s) => s.id === id) ?? t.sections.find((s) => s.type === 'body') ?? null;
  });

  readonly selectedBlocks = computed<Block[]>(() => {
    const t = this._template();
    const ids = this._selectedIds();
    if (!t) return [];
    const out: Block[] = [];
    const visit = (b: Block): void => {
      if (ids.has(b.id)) out.push(b);
      if (b.type === 'repeater') for (const c of b.items) visit(c);
    };
    for (const sec of t.sections) for (const b of sec.blocks) visit(b);
    return out;
  });

  /** Find a block anywhere in the template tree (top-level or nested inside
   *  a repeater's items). Returns the block and, if it's a child, the parent
   *  repeater so callers can do parent-relative math (positioning, deletion). */
  findBlock(id: string): { block: Block; parent: Block | null } | null {
    const t = this._template();
    if (!t) return null;
    for (const sec of t.sections) {
      for (const b of sec.blocks) {
        if (b.id === id) return { block: b, parent: null };
        if (b.type === 'repeater') {
          for (const c of b.items) {
            if (c.id === id) return { block: c, parent: b };
          }
        }
      }
    }
    return null;
  }

  setTemplate(template: ReportTemplate): void {
    // Snapshots describe the outgoing design; a different template must not
    // inherit them or a size change could restore the wrong document.
    this.pageSnapshots.clear();
    this.lastResize = null;
    this._template.set(template);
    const body = template.sections.find((s) => s.type === 'body') ?? template.sections[0];
    this._activeSectionId.set(body?.id ?? null);
    this._selectedIds.set(new Set());
  }

  setZoom(z: number): void {
    this._zoom.set(Math.max(0.25, Math.min(3, z)));
  }

  setActiveSection(id: string): void {
    this._activeSectionId.set(id);
    this._selectedIds.set(new Set());
  }

  // ─── Page settings ──────────────────────────────────────────

  /** Patch the page setup (size, orientation, margins, repeatHeader, …). */
  updatePage(patch: Partial<PageSetup>): void {
    const t = this._template();
    if (!t) return;
    this._template.set({ ...t, page: { ...t.page, ...patch } });
  }

  /**
   * The design as it stood the last time each page setup was active, keyed by
   * `size|orientation|margins`, plus a fingerprint of what the last resize
   * produced. Together they make size changes reversible: flip to landscape
   * and back and the portrait design returns byte-identical, instead of
   * being scaled down twice. Session-only — nothing is persisted.
   */
  private readonly pageSnapshots = new Map<string, ReportTemplate>();
  private lastResize: { key: string; geometry: string } | null = null;

  private pageKey(page: PageSetup): string {
    const { size, orientation, customWidth, customHeight, margins } = page;
    return [
      size,
      orientation,
      customWidth ?? '',
      customHeight ?? '',
      margins.top,
      margins.right,
      margins.bottom,
      margins.left,
    ].join('|');
  }

  private geometryFingerprint(t: ReportTemplate): string {
    return JSON.stringify(t.sections);
  }

  /**
   * Apply a page-geometry patch AND refit the design to the new page.
   *
   * Block coordinates are absolute mm inside the content box, so changing the
   * paper alone would leave an A4 layout hanging off the right edge of an A5
   * sheet. Two rules:
   *
   *  - Scaling is UNIFORM and driven by the CONTENT WIDTH ratio alone. Two
   *    reasons. Per-axis factors stretch every block when the page's
   *    proportions change, which is exactly what a portrait↔landscape flip
   *    does (180×267 → 267×180 would widen by 1.48 and squash by 0.67). And
   *    `min(widthRatio, heightRatio)` shrinks in BOTH directions, so every
   *    orientation toggle made the design smaller. Width is the axis that
   *    clips: too wide and content is lost off the edge, too tall and the
   *    paginator simply flows it onto another page.
   *  - Returning to a page setup restores the design that was there, as long
   *    as nothing has been edited since — exact down to the last decimal,
   *    where re-scaling would only be close. If the design HAS been edited,
   *    the edits win and it's scaled to fit as usual.
   *
   * Either way it's a single template mutation, so one Ctrl+Z takes the user
   * back to the old size *and* the old geometry.
   */
  private resizePage(patch: Partial<PageSetup>): void {
    const t = this._template();
    if (!t) return;
    const nextPage: PageSetup = { ...t.page, ...patch };
    const fromKey = this.pageKey(t.page);
    const toKey = this.pageKey(nextPage);
    if (fromKey === toKey) {
      this.updatePage(patch);
      return;
    }

    const before = computePageDimensions(t.page);
    const after = computePageDimensions(nextPage);
    if (before.contentWidth <= 0 || before.contentHeight <= 0) {
      this.updatePage(patch);
      return;
    }

    // Whatever is on screen now belongs to the page setup being left.
    this.pageSnapshots.set(fromKey, t);

    const untouched =
      this.lastResize?.key === fromKey && this.lastResize.geometry === this.geometryFingerprint(t);
    const restored = untouched ? this.pageSnapshots.get(toKey) : undefined;

    let next: ReportTemplate;
    if (restored) {
      next = { ...restored, page: nextPage };
    } else {
      const f = after.contentWidth / before.contentWidth;
      const factors: ScaleFactors = { x: f, y: f, font: f };
      next = { ...scaleTemplateGeometry(t, factors), page: nextPage };
    }

    this._template.set(next);
    this.lastResize = { key: toKey, geometry: this.geometryFingerprint(next) };
  }

  setPaperSize(size: PaperSize): void { this.resizePage({ size }); }
  setOrientation(orientation: Orientation): void { this.resizePage({ orientation }); }
  setRepeatHeader(repeat: boolean): void { this.updatePage({ repeatHeader: repeat }); }
  setRepeatFooter(repeat: boolean): void { this.updatePage({ repeatFooter: repeat }); }
  setPageBackground(color: string | undefined): void { this.updatePage({ background: color }); }

  // ─── Theme ────────────────────────────────────────────────────

  /** Patch a single theme color slot. Doesn't touch any blocks — use
   *  `applyThemePreset` if you want existing on-theme blocks to recolor too. */
  setThemeColor(
    key:
      | 'primaryColor'
      | 'onPrimaryColor'
      | 'secondaryColor'
      | 'accentColor'
      | 'textColor'
      | 'mutedColor'
      | 'surfaceColor',
    color: string | undefined,
  ): void {
    const t = this._template();
    if (!t) return;
    const merged: TenantTheme = { ...(t.theme ?? { id: 'theme' }), [key]: color };
    this._template.set({ ...t, theme: merged });
  }

  /**
   * Apply a theme preset (or any partial theme update). Two passes:
   *
   *   1. Update `template.theme` with the new values.
   *   2. Walk every block + the page background and remap any color value
   *      that exactly matched a PREVIOUS theme slot to the corresponding
   *      NEW slot. This is the "rebrand in one click" path for blocks that
   *      were colored using the theme-swatch quick-picks; ad-hoc custom
   *      hex colors are left alone (they don't match the remap table).
   *
   * Colors compare case-insensitively. The page background, block style
   * (background / font.color / border-side colors), and type-specific color
   * fields (line.color, rectangle.fill, divider.color, table.zebraColor,
   * payments.zebraColor, table column header/cell styles) are all remapped.
   */

  /** Patch a single side of the page margins, preserving the others. */
  setPageMargin(side: keyof PageMargins, value: number): void {
    const t = this._template();
    if (!t) return;
    this.updatePage({
      margins: { ...t.page.margins, [side]: Math.max(0, Number(value) || 0) },
    });
  }

  /** Custom paper dimensions (only honored when `size === 'Custom'`).
   *
   *  Deliberately does NOT rescale the design the way `setPaperSize` does:
   *  this fires on every keystroke of a number input, so typing "148" would
   *  rescale through 1 → 14 → 148 and the intermediate roundings would
   *  destroy the layout before the user finished the number. */
  setCustomPageSize(widthMm: number | undefined, heightMm: number | undefined): void {
    this.updatePage({ customWidth: widthMm, customHeight: heightMm });
  }

  /** Patch a single watermark field without disturbing the others. Setting
   *  `image` clears `text` (and vice versa) — pdfmake/HTML render only one. */
  patchWatermark(patch: Partial<NonNullable<PageSetup['watermark']>>): void {
    const t = this._template();
    if (!t) return;
    const wm = { ...(t.page.watermark ?? {}), ...patch };
    if ('image' in patch && patch.image) wm.text = undefined;
    if ('text' in patch && patch.text) wm.image = undefined;
    // Drop the watermark entirely when both content fields are empty.
    const empty = !wm.text && !wm.image;
    this.updatePage({ watermark: empty ? undefined : wm });
  }

  /** Override the explicit height of a section (page-header, page-footer,
   *  first-page-header, last-page-footer). Pass `undefined` to clear so the
   *  pagination engine falls back to "max bottom edge of contained blocks".
   *  No-op when no section of that type exists. */
  setSectionHeight(type: Section['type'], heightMm: number | undefined): void {
    const t = this._template();
    if (!t) return;
    const section = t.sections.find((s) => s.type === type);
    if (!section) return;
    this.mutateSection(section.id, (s) => ({
      ...s,
      height: heightMm === undefined || !Number.isFinite(heightMm) ? undefined : Math.max(0, heightMm),
    }));
  }

  // ─── Selection ──────────────────────────────────────────────

  select(id: string, additive = false): void {
    if (additive) {
      const next = new Set(this._selectedIds());
      next.has(id) ? next.delete(id) : next.add(id);
      this._selectedIds.set(next);
    } else {
      this._selectedIds.set(new Set([id]));
    }
  }
  selectMany(ids: string[]): void {
    this._selectedIds.set(new Set(ids));
  }
  clearSelection(): void {
    this._selectedIds.set(new Set());
  }

  // ─── Block CRUD ─────────────────────────────────────────────

  addBlock(type: BlockType, x?: number, y?: number, sectionId?: string): Block | null {
    const t = this._template();
    if (!t) return null;
    const target =
      (sectionId && t.sections.find((s) => s.id === sectionId)) ||
      this.activeSection() ||
      t.sections.find((s) => s.type === 'body') ||
      t.sections[0];
    if (!target) return null;
    const def = blockRegistry.require(type);
    const id = `b_${Math.random().toString(36).slice(2, 10)}`;
    const block = def.factory(id);
    if (x !== undefined) block.position.x = x;
    if (y !== undefined) block.position.y = y;
    this.mutateSection(target.id, (s) => ({ ...s, blocks: [...s.blocks, block] }));
    this.select(block.id);
    return block;
  }

  /** Insert a block as a child of an existing `repeater`. Used by the canvas
   *  when the user drops a toolbox tile while the repeater is selected, and
   *  by the property panel's "Add child" action. */
  addChildBlock(parentId: string, type: BlockType, x?: number, y?: number): Block | null {
    const t = this._template();
    if (!t) return null;
    const def = blockRegistry.require(type);
    const id = `b_${Math.random().toString(36).slice(2, 10)}`;
    const child = def.factory(id);
    if (x !== undefined) child.position.x = x;
    if (y !== undefined) child.position.y = y;
    this.patchBlock<Block>(parentId, (p) => {
      if (p.type !== 'repeater') return p;
      return { ...p, items: [...p.items, child] };
    });
    this.select(child.id);
    return child;
  }

  updateBlock(id: string, patch: Partial<Block>): void {
    this.patchBlock<Block>(id, (b) => ({ ...b, ...patch } as Block));
  }

  /** Generic deep-update. Walks every section AND every repeater's `items[]`
   *  so blocks nested inside a card can be patched the same way as top-level
   *  blocks. The updater is invoked exactly once on the block whose id matches. */
  patchBlock<T extends Block>(id: string, updater: (block: T) => T): void {
    const t = this._template();
    if (!t) return;
    const visit = (b: Block): Block => {
      if (b.id === id) return updater(b as T);
      if (b.type === 'repeater') return { ...b, items: b.items.map(visit) };
      return b;
    };
    this._template.set({
      ...t,
      sections: t.sections.map((s) => ({ ...s, blocks: s.blocks.map(visit) })),
    });
  }

  deleteSelected(): void {
    const ids = this._selectedIds();
    if (ids.size === 0) return;
    const t = this._template();
    if (!t) return;
    const filter = (b: Block): Block | null => {
      if (ids.has(b.id)) return null;
      if (b.type === 'repeater') {
        return { ...b, items: b.items.map(filter).filter((x): x is Block => x !== null) };
      }
      return b;
    };
    this._template.set({
      ...t,
      sections: t.sections.map((s) => ({
        ...s,
        blocks: s.blocks.map(filter).filter((b): b is Block => b !== null),
      })),
    });
    this._selectedIds.set(new Set());
  }

  /** Duplicate every selected block in place (slightly offset). Walks all
   *  sections AND every repeater's `items[]` so children selected inside a
   *  card duplicate inside that same card rather than orphaning to the body.
   *  The new blocks become the selection. */
  duplicateSelected(): void {
    const ids = this._selectedIds();
    const t = this._template();
    if (!t || ids.size === 0) return;
    const newIds = new Set<string>();
    const dupBlock = (b: Block): Block => {
      const id = `b_${Math.random().toString(36).slice(2, 10)}`;
      newIds.add(id);
      return {
        ...b,
        id,
        position: { x: b.position.x + 5, y: b.position.y + 5 },
      };
    };
    // For repeaters, also walk items[] so children selected inside a card
    // get duplicated inside the same card.
    const visitItems = (items: Block[]): Block[] => {
      const out: Block[] = [];
      for (const item of items) {
        out.push(item);
        if (ids.has(item.id)) out.push(dupBlock(item));
      }
      return out;
    };
    this._template.set({
      ...t,
      sections: t.sections.map((s) => {
        const blocks: Block[] = [];
        for (const b of s.blocks) {
          // Recurse into repeater children first so a parent-and-child
          // multi-select still produces correct nested duplicates.
          const visited = b.type === 'repeater' ? { ...b, items: visitItems(b.items) } : b;
          blocks.push(visited);
          if (ids.has(b.id)) blocks.push(dupBlock(visited));
        }
        return { ...s, blocks };
      }),
    });
    if (newIds.size > 0) this._selectedIds.set(newIds);
  }

  bringToFront(id: string): void {
    this.patchBlock(id, (b) => ({ ...b, zIndex: (b.zIndex ?? 1) + 1 }));
  }

  sendToBack(id: string): void {
    this.patchBlock(id, (b) => ({ ...b, zIndex: Math.max(0, (b.zIndex ?? 1) - 1) }));
  }

  // ─── internals ──────────────────────────────────────────────

  private mutateSection(sectionId: string, updater: (s: Section) => Section): void {
    const t = this._template();
    if (!t) return;
    this._template.set({
      ...t,
      sections: t.sections.map((s) => (s.id === sectionId ? updater(s) : s)),
    });
  }

  /** Snapshot for history. */
  snapshot(): ReportTemplate | null {
    return this._template();
  }

  /** Restore from snapshot — used by undo/redo. */
  restore(snapshot: ReportTemplate): void {
    this._template.set(snapshot);
  }
}
