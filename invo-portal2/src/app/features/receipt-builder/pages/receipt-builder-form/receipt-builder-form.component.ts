import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  HostListener,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { OverlayModule } from '@angular/cdk/overlay';
import {
  CdkDragDrop,
  DragDropModule,
  moveItemInArray,
} from '@angular/cdk/drag-drop';

import { withTranslations } from '@core/i18n/with-translations';
import type { CanLeaveComponent } from '@core/guards/unsaved-changes.guard';
import { LoadingOverlayComponent } from '@shared/components/spinner/loading-overlay.component';
import { DesktopOnlyNoticeComponent } from '@shared/components/desktop-only-notice/desktop-only-notice.component';
import { TooltipDirective } from '@shared/directives/tooltip.directive';
import { ElementEditorComponent } from './components/element-editor/element-editor.component';
import { ElementRenderComponent } from './components/element-render/element-render.component';
import { ElementsListComponent } from './components/elements-list/elements-list.component';
import { RbfWidgetComponent } from './components/rbf-widget/rbf-widget.component';
import { RbfWidgetCoordinator } from './components/rbf-widget/rbf-widget-coordinator.service';
import { ModalService } from '@shared/modal/modal.service';
import { ConfirmModalComponent, ConfirmModalData } from '@shared/modal/demo/confirm-modal.component';
import { CompanyService } from '@core/auth/company.service';

import { ReceiptBuilderService } from '../../services/receipt-builder.service';
import {
  PALETTE_ITEMS,
  PaletteItem,
  PrintElement,
  ReceiptTemplate,
  ReceiptTemplateSummary,
  TemplateType,
  defaultKitchenElements,
  defaultReceiptElements,
  makeElement,
  parseElements,
} from '../../services/receipt-builder.types';
import {
  DEMO_PROFILES,
  DEFAULT_PROFILE_ID,
  DemoProfile,
} from '../../services/binding-resolver';

/** Empty placeholder template — used only for the signal's initial
 *  value before `loadTemplate()` runs. Always replaced before the
 *  user sees the canvas. */
const EMPTY_TEMPLATE = (templateType: TemplateType): ReceiptTemplate => ({
  id:              '',
  companyId:       '',
  name:            '',
  templateType,
  recieptTemplate: [],
});

/** Seed a fresh template with the legacy default elements per type —
 *  receipts get the long header/totals/payment block, kitchen tickets
 *  get the section/server/lines/ref layout. The user lands on a
 *  filled-in starting point instead of a blank page (mirrors the
 *  legacy `setNewTemplate()` behaviour). */
const DEFAULT_TEMPLATE = (templateType: TemplateType): ReceiptTemplate => ({
  id:              '',
  companyId:       '',
  name:            '',
  templateType,
  recieptTemplate: templateType === 'kitchen'
    ? defaultKitchenElements()
    : defaultReceiptElements(),
});

/**
 * One step in the undo/redo timeline. `template` is a deep clone of
 * the state taken BEFORE the mutation that's about to run — so undo
 * is just "restore this snapshot." `kind` lets the form coalesce
 * consecutive same-kind edits (typing into a Text value shouldn't
 * fill the stack with 50 entries).
 */
interface HistoryEntry {
  template:    ReceiptTemplate;
  description: string;
  kind:        string;
  timestamp:   number;
}

/**
 * Receipt Builder → full-page form.
 *
 * Layout (mirrors table-management):
 *   • Top bar     — Home button (back to list), name input, type chip, Save.
 *   • Left rail   — palette of print-element tiles (Add to template).
 *   • Centre      — receipt-paper canvas; vertical CDK drop list of placed
 *                   elements with reorder + delete + select.
 *   • Right panel — per-element editor placeholder (slice 3 will fill in).
 *
 * No sidebar/topbar chrome (registered as a top-level route in
 * `app.routes.ts`). Sticky save bar lives in the top bar so the user
 * can always reach it.
 */
@Component({
  selector: 'app-receipt-builder-form',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    FormsModule,
    TranslateModule,
    DragDropModule,
    OverlayModule,
    LoadingOverlayComponent,
    DesktopOnlyNoticeComponent,
    ElementEditorComponent,
    ElementRenderComponent,
    ElementsListComponent,
    RbfWidgetComponent,
    TooltipDirective,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './receipt-builder-form.component.html',
  styleUrl: './receipt-builder-form.component.scss',
})
export class ReceiptBuilderFormComponent implements OnInit, CanLeaveComponent {
  private service    = inject(ReceiptBuilderService);
  private translate  = inject(TranslateService);
  private destroyRef = inject(DestroyRef);
  private router     = inject(Router);
  private route      = inject(ActivatedRoute);
  private modal      = inject(ModalService);
  private companies  = inject(CompanyService);
  private widgets    = inject(RbfWidgetCoordinator);

  loading = signal<boolean>(false);
  saving  = signal<boolean>(false);

  template = signal<ReceiptTemplate>(EMPTY_TEMPLATE('recieptType'));
  /** Snapshot the saved state so `isDirty` is just a string compare. */
  private snapshot = signal<string>('');

  // ─── History ───────────────────────────────────────────────────────────
  // Two stacks of "before" snapshots — `undoStack` holds states to roll
  // BACK to, `redoStack` holds states to roll FORWARD into. Each entry
  // also carries a `kind` key used to coalesce consecutive same-kind
  // edits (e.g. typing into a Text element shouldn't push 50 undo
  // steps — just one for the whole burst).
  private undoStack = signal<HistoryEntry[]>([]);
  private redoStack = signal<HistoryEntry[]>([]);
  private readonly HISTORY_CAP   = 50;     // hard cap on stack size
  private readonly COALESCE_MS   = 800;    // typing within this is one entry

  undoCount = computed<number>(() => this.undoStack().length);
  redoCount = computed<number>(() => this.redoStack().length);
  canUndo   = computed<boolean>(() => this.undoCount() > 0);
  canRedo   = computed<boolean>(() => this.redoCount() > 0);
  /** Most recent entry's description — surfaced in the undo/redo
   *  button tooltips so the user can see what'll be reversed. */
  lastUndoDesc = computed<string>(() => this.undoStack().at(-1)?.description ?? '');
  lastRedoDesc = computed<string>(() => this.redoStack().at(-1)?.description ?? '');

  /** Currently selected element by `__key`; empty string when nothing
   *  selected. The right-panel editor (slice 3) will key on this. */
  selectedKey = signal<string>('');

  // ─── Templates quick-switcher ──────────────────────────────────────────
  // The top-bar "Templates" button opens a popover with every receipt /
  // kitchen template the tenant has, so the user can hop between them
  // without bouncing back to the list page. List is fetched lazily on
  // first open and cached for the rest of the session.
  templatesMenuOpen = signal<boolean>(false);
  templatesSearch   = signal<string>('');
  templatesList     = signal<ReceiptTemplateSummary[]>([]);
  templatesLoading  = signal<boolean>(false);

  filteredTemplates = computed<ReceiptTemplateSummary[]>(() => {
    const list = this.templatesList();
    const q = this.templatesSearch().trim().toLowerCase();
    if (!q) return list;
    return list.filter((t) => (t.name || '').toLowerCase().includes(q));
  });

  // ─── Live-preview demo data ────────────────────────────────────────────
  // The canvas renders bindings (`!invoice.refrenceNumber` etc.) against
  // a sample profile so the user sees a realistic preview while editing.
  // Profile is purely presentational — it never affects the template
  // payload that's saved to the server.
  readonly demoProfiles = DEMO_PROFILES;
  activeProfileId = signal<string>(DEFAULT_PROFILE_ID);
  /** Active profile augmented with the *current* tenant's identity —
   *  pulls `preferences.logo` (and friends) off `CompanyService` so a
   *  bound `!preferences.logo` resolves to the user's actual receipt
   *  logo on the canvas, not the demo placeholder. The base profile
   *  still drives invoice-specific data (lines / customer / etc.).
   *
   *  Logo source matches the legacy `getLogo()` helper:
   *    `this.company.mediaUrl.defaultUrl` is the loadable URL.
   *  We fall back to `logoUrl` / `logo` so older Company shapes still
   *  work, but `mediaUrl.defaultUrl` is the canonical field. */
  activeProfile = computed<DemoProfile>(() => {
    const base = this.demoProfiles.find((p) => p.id === this.activeProfileId()) ?? this.demoProfiles[0];
    const company = this.companies.currentCompany() as
      | { name?: string; logo?: string; logoUrl?: string; mediaUrl?: { defaultUrl?: string } }
      | null;
    const realLogo = company?.mediaUrl?.defaultUrl
      || company?.logoUrl
      || company?.logo
      || '';
    return {
      ...base,
      preferences: {
        ...base.preferences,
        logo: realLogo || base.preferences.logo || '',
        // Use the tenant's actual name when available so the preview
        // reads with the user's branding rather than "Acme Coffee".
        name: company?.name || base.preferences.name,
      },
    };
  });

  readonly paletteItems = PALETTE_ITEMS;

  private i18nTick = signal(0);

  // ─── Derived ───────────────────────────────────────────────────────────
  isDirty = computed<boolean>(() => JSON.stringify(this.template()) !== this.snapshot());

  /** A "new" template is one that hasn't been saved yet (no server
   *  id). These get a type-switcher in the top bar; saved templates
   *  hide it because changing the type after-the-fact would require
   *  the server side to re-key the document and isn't supported. */
  isNewTemplate = computed<boolean>(() => !this.template().id);

  heading = computed<string>(() => {
    this.i18nTick();
    return this.template().id
      ? this.template().name || this.translate.instant('RECEIPT_BUILDER.EDIT_TEMPLATE')
      : this.translate.instant('RECEIPT_BUILDER.NEW_TEMPLATE');
  });

  selectedElement = computed<PrintElement | null>(() => {
    const key = this.selectedKey();
    if (!key) return null;
    return this.template().recieptTemplate.find((e) => e.__key === key) ?? null;
  });

  saveLabel = computed<string>(() => {
    this.i18nTick();
    return this.translate.instant('COMMON.SAVING');
  });

  constructor() {
    withTranslations('receipt-builder');
    this.translate.onTranslationChange.pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.i18nTick.update((n) => n + 1));
    this.translate.onLangChange.pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.i18nTick.update((n) => n + 1));
  }

  ngOnInit(): void {
    // Restore the user's saved right-rail width before the workspace
    // renders so the layout doesn't flash from default to preference.
    try {
      const stored = localStorage.getItem(ReceiptBuilderFormComponent.RAIL_KEY);
      if (stored) {
        const w = Math.min(
          ReceiptBuilderFormComponent.RAIL_MAX,
          Math.max(ReceiptBuilderFormComponent.RAIL_MIN, Number(stored)),
        );
        if (Number.isFinite(w)) this.applyRailWidth(w);
      }
    } catch { /* localStorage unavailable */ }

    // Subscribe to paramMap so navigating between templates within the
    // same route (e.g. via the top-bar Templates picker) triggers a
    // reload — the router reuses this component when only `:id`
    // changes, so a one-off `snapshot` read in `ngOnInit` would leave
    // the canvas frozen on the first-loaded template.
    this.route.paramMap.pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((params) => {
        const id = params.get('id') ?? 'new';
        const queryType = this.route.snapshot.queryParamMap.get('type') as TemplateType | null;
        void this.loadTemplate(id, queryType);
      });
  }

  /** Load the template at `id` (or seed a blank one when `id === 'new'`)
   *  and reset every per-template piece of view state — selection,
   *  history stacks, snapshot — so the editor lands cleanly on the new
   *  template. Pulled out of `ngOnInit` so the paramMap subscription
   *  can call it on every navigation. */
  private async loadTemplate(id: string, queryType: TemplateType | null): Promise<void> {
    if (id && id !== 'new') {
      this.loading.set(true);
      try {
        const loaded = await this.service.getById(id);
        if (loaded) {
          this.template.set({
            ...loaded,
            recieptTemplate: parseElements(loaded.recieptTemplate),
          });
        }
      } finally {
        this.loading.set(false);
      }
    } else {
      // Fresh template — seed the legacy starter elements for the
      // chosen type so the user starts on a filled-in canvas. The
      // initial snapshot is captured below, so the seeded template
      // reads as the not-dirty baseline; only edits the user makes
      // afterwards flip `isDirty` on.
      this.template.set(DEFAULT_TEMPLATE(queryType === 'kitchen' ? 'kitchen' : 'recieptType'));
    }
    this.snapshot.set(JSON.stringify(this.template()));
    // Drop selection + history — the loaded state is the new "epoch"
    // the user can't undo past. Without this reset, undo could
    // teleport into a previous template's structure.
    this.selectedKey.set('');
    this.undoStack.set([]);
    this.redoStack.set([]);
  }

  hasUnsavedChanges(): boolean { return this.isDirty() && !this.saving(); }

  // ─── Header field updates ──────────────────────────────────────────────
  patch<K extends keyof ReceiptTemplate>(key: K, value: ReceiptTemplate[K]): void {
    // History coalesces by field name so a burst of "name" keystrokes
    // collapses into one undo entry, but switching from name → type
    // pushes a fresh entry (different kind).
    this.captureBefore(`Edit ${String(key)}`, `template:${String(key)}`);
    this.template.update((t) => ({ ...t, [key]: value }));
  }

  // ─── Element ops ───────────────────────────────────────────────────────
  /** Append the element produced by `item.factory()` and select it.
   *  `item` is the palette tile the user clicked (or dragged) — same
   *  factory drives both code paths so behaviour stays consistent. */
  addElement(item: PaletteItem): void {
    // Each "add" gets its own undo entry — kind suffixed with the
    // current timestamp so consecutive adds don't coalesce.
    this.captureBefore(`Add ${item.id}`, `add:${Date.now()}`);
    const fresh = item.factory();
    this.template.update((t) => ({
      ...t,
      recieptTemplate: [...t.recieptTemplate, fresh],
    }));
    // Bring the new element into view — clicking a palette tile when
    // the canvas already has many elements would otherwise leave the
    // freshly-appended element scrolled off below the fold. Same
    // pattern as `selectElement(el, { scroll: true })` from the
    // layers panel; defer past the next CD so the slot's DOM exists.
    this.selectElement(fresh, { scroll: true });
  }

  removeElement(el: PrintElement, ev?: Event): void {
    ev?.stopPropagation();
    this.captureBefore(`Remove ${el.type}`, `remove:${el.__key}`);
    this.template.update((t) => ({
      ...t,
      recieptTemplate: t.recieptTemplate.filter((e) => e.__key !== el.__key),
    }));
    if (this.selectedKey() === el.__key) this.selectedKey.set('');
  }

  duplicateElement(el: PrintElement, ev?: Event): void {
    ev?.stopPropagation();
    const idx = this.template().recieptTemplate.findIndex((e) => e.__key === el.__key);
    if (idx < 0) return;
    this.captureBefore(`Duplicate ${el.type}`, `duplicate:${el.__key}:${Date.now()}`);
    // Deep clone, drop the server id, regenerate a fresh local key so
    // the dupe gets its own selection identity.
    const clone: PrintElement = {
      ...JSON.parse(JSON.stringify(el)),
      id: '',
      __key: makeElement(el.type).__key,
    };
    this.template.update((t) => {
      const next = [...t.recieptTemplate];
      next.splice(idx + 1, 0, clone);
      return { ...t, recieptTemplate: next };
    });
    this.selectedKey.set(clone.__key ?? '');
  }

  // ─── Right-rail splitter ─────────────────────────────────────────────
  // Drives the `--rbf-right-rail-w` CSS variable so the user can pull
  // the rail wider when they need more room for tabs. Width is
  // clamped + persisted to localStorage so the choice survives
  // reloads. Mouse moves are bound at drag-start time and torn down
  // on mouseup so we don't leak listeners.
  private static readonly RAIL_MIN  = 240;
  private static readonly RAIL_MAX  = 640;
  private static readonly RAIL_KEY  = 'rbf:right-rail-w';

  splitterDragging = signal<boolean>(false);
  private splitterMoveHandler:  ((e: MouseEvent) => void) | null = null;
  private splitterEndHandler:   (() => void) | null = null;

  onSplitterMouseDown(event: MouseEvent): void {
    event.preventDefault();
    this.splitterDragging.set(true);

    document.body.style.cursor    = 'col-resize';
    document.body.style.userSelect = 'none';

    // Capture direction at drag-start. In RTL the grid lays out the
    // "right rail" on the visual LEFT of the workspace, so the rail's
    // width grows as the cursor moves *right* from the rail edge.
    const isRtl = getComputedStyle(document.documentElement).direction === 'rtl';

    this.splitterMoveHandler = (e: MouseEvent) => {
      // LTR: rail sits on the right — width = distance from cursor
      //      to the right edge of the viewport (minus 16px padding).
      // RTL: rail sits on the left — width = cursor X minus the
      //      workspace's left padding (16px).
      const raw = isRtl
        ? e.clientX - 16
        : window.innerWidth - e.clientX - 16;
      const w = Math.min(
        ReceiptBuilderFormComponent.RAIL_MAX,
        Math.max(ReceiptBuilderFormComponent.RAIL_MIN, raw),
      );
      this.applyRailWidth(w);
    };
    this.splitterEndHandler = () => {
      this.splitterDragging.set(false);
      document.body.style.cursor    = '';
      document.body.style.userSelect = '';
      if (this.splitterMoveHandler) {
        window.removeEventListener('mousemove', this.splitterMoveHandler);
        this.splitterMoveHandler = null;
      }
      if (this.splitterEndHandler) {
        window.removeEventListener('mouseup', this.splitterEndHandler);
        this.splitterEndHandler = null;
      }
    };

    window.addEventListener('mousemove', this.splitterMoveHandler);
    window.addEventListener('mouseup',   this.splitterEndHandler);
  }

  /** Set the CSS variable + persist. Pulled out so both the restore
   *  path (ngOnInit) and the drag handler share one code path. */
  private applyRailWidth(w: number): void {
    document.documentElement.style.setProperty('--rbf-right-rail-w', `${w}px`);
    try { localStorage.setItem(ReceiptBuilderFormComponent.RAIL_KEY, String(w)); }
    catch { /* swallow */ }
  }

  /** Switch the new template's type (recieptType ↔ kitchen). Always
   *  destructive — the saved data shape diverges between the two
   *  (kitchen has its own default elements + the line-options block
   *  carries different toggles), so we don't try to migrate. The
   *  user gets a confirm modal first so the data loss is intentional.
   *  Disabled for already-saved templates because the server would
   *  need to re-key the document and that isn't supported here. */
  async switchTemplateType(next: TemplateType): Promise<void> {
    if (next === this.template().templateType) return;
    if (!this.isNewTemplate()) return;

    const ok = await this.confirm({
      title:   this.translate.instant('RECEIPT_BUILDER.SWITCH_TYPE_TITLE'),
      message: this.translate.instant('RECEIPT_BUILDER.SWITCH_TYPE_MESSAGE'),
      confirm: this.translate.instant('RECEIPT_BUILDER.SWITCH_TYPE_CONFIRM'),
      danger:  true,
    });
    if (!ok) return;

    // Reset every per-template piece of state — the new type starts
    // clean. Same as `loadTemplate('new')` minus the route navigation.
    this.template.set(DEFAULT_TEMPLATE(next));
    this.snapshot.set(JSON.stringify(this.template()));
    this.selectedKey.set('');
    this.undoStack.set([]);
    this.redoStack.set([]);
  }

  /** Collapse / expand every widget under a rail. The keyPrefix scopes
   *  the broadcast: `'el:'` hits only the element-editor widgets,
   *  empty hits everything (used by the left rail's palette / future
   *  rail-wide controls). */
  collapseAllWidgets(keyPrefix: string): void {
    this.widgets.setAll(keyPrefix, true);
  }

  expandAllWidgets(keyPrefix: string): void {
    this.widgets.setAll(keyPrefix, false);
  }

  /** Click on the canvas wrap (or its background) — deselect the
   *  current element when the click didn't land on a slot. Slot
   *  clicks bubble through here too, but `closest('.rbf-slot')`
   *  catches them and we let the slot's own select handler win. */
  onCanvasBackgroundClick(event: MouseEvent): void {
    const target = event.target as HTMLElement | null;
    if (target?.closest('.rbf-slot')) return;
    this.selectedKey.set('');
  }

  selectElement(el: PrintElement, opts?: { scroll?: boolean }): void {
    this.selectedKey.set(el.__key ?? '');
    // Bring the slot into view when called from a non-canvas action
    // (palette click → addElement, layers panel click). For
    // freshly-added elements the slot's DOM doesn't exist yet at
    // microtask time — Angular's CD hasn't run. Two `requestAnimationFrame`
    // hops + `setTimeout` fallback give CD + paint enough time to
    // mount the slot before we hunt for it; if it's still missing
    // we retry once more.
    if (opts?.scroll && el.__key) {
      const id = 'rbf-slot-' + el.__key;
      const tryScroll = (retry: number) => {
        const node = document.getElementById(id);
        if (node) {
          node.scrollIntoView({ behavior: 'smooth', block: 'center' });
          return;
        }
        if (retry > 0) setTimeout(() => tryScroll(retry - 1), 50);
      };
      requestAnimationFrame(() => requestAnimationFrame(() => tryScroll(3)));
    }
  }

  /**
   * Patch a single field on the *selected* element. The editor panel
   * components emit `(change)` with `{ key, value }` and the form
   * funnels every edit through this single helper so isDirty +
   * change-detection light up consistently.
   *
   * Element typing: the editor-panel components already type-narrow
   * by `el.type`, so the field key is statically known to be a key
   * of the matching element type. We accept `unknown` here to keep
   * the form blind to per-type schemas — the editor is the source
   * of truth for which fields exist.
   */
  patchSelectedElement(key: string, value: unknown): void {
    const id = this.selectedKey();
    if (!id) return;
    // Coalesce typing into the same field on the same element into a
    // single undo entry. `kind` is `patch:<elementKey>:<field>` so two
    // separate fields don't merge.
    this.captureBefore(`Edit ${key}`, `patch:${id}:${key}`);
    this.template.update((t) => ({
      ...t,
      recieptTemplate: t.recieptTemplate.map((e) =>
        e.__key === id ? ({ ...e, [key]: value } as PrintElement) : e,
      ),
    }));
  }

  // ─── History (undo / redo) ─────────────────────────────────────────────
  /**
   * Capture the current template into the undo stack BEFORE running
   * a mutation. Coalesces same-`kind` rapid-fire edits within
   * `COALESCE_MS` so typing 50 chars stays one undo step.
   *
   * `kind` is the coalesce key — pass a stable value (e.g.
   * `'patch:<key>:<field>'`) so consecutive edits to the same field
   * merge. Pass a unique value (e.g. `'add:<timestamp>'`) when you
   * explicitly want a fresh entry.
   */
  private captureBefore(description: string, kind: string): void {
    const now = Date.now();
    this.undoStack.update((s) => {
      const last = s[s.length - 1];
      // Coalesce: skip pushing when the previous entry has the same
      // kind and is fresh enough — keeps the older snapshot as the
      // undo target, so a single Ctrl+Z reverses the whole burst.
      if (last && last.kind === kind && now - last.timestamp < this.COALESCE_MS) {
        return s;
      }
      const entry: HistoryEntry = {
        template:    this.cloneTemplate(this.template()),
        description,
        kind,
        timestamp: now,
      };
      const next = [...s, entry];
      return next.length > this.HISTORY_CAP ? next.slice(-this.HISTORY_CAP) : next;
    });
    // Any new mutation drops the redo stack — the user diverged from
    // the previous "future."
    if (this.redoStack().length > 0) this.redoStack.set([]);
  }

  undo(): void {
    const stack = this.undoStack();
    if (stack.length === 0) return;
    const entry = stack[stack.length - 1];
    // Push the *current* state onto redo so the user can roll forward.
    this.redoStack.update((r) => [
      ...r,
      { ...entry, template: this.cloneTemplate(this.template()) },
    ]);
    this.template.set(entry.template);
    this.undoStack.set(stack.slice(0, -1));
    // Selection might point at a no-longer-existing element after a
    // restore — clear it if so.
    if (!this.template().recieptTemplate.some((e) => e.__key === this.selectedKey())) {
      this.selectedKey.set('');
    }
  }

  redo(): void {
    const stack = this.redoStack();
    if (stack.length === 0) return;
    const entry = stack[stack.length - 1];
    this.undoStack.update((u) => [
      ...u,
      { ...entry, template: this.cloneTemplate(this.template()) },
    ]);
    this.template.set(entry.template);
    this.redoStack.set(stack.slice(0, -1));
    if (!this.template().recieptTemplate.some((e) => e.__key === this.selectedKey())) {
      this.selectedKey.set('');
    }
  }

  private cloneTemplate(t: ReceiptTemplate): ReceiptTemplate {
    return JSON.parse(JSON.stringify(t));
  }

  /**
   * Cmd/Ctrl + Z → undo, Cmd/Ctrl + Shift + Z (or Y) → redo.
   * Skip when an editable field has focus AND the user is typing
   * single-char keys (browser handles those natively in inputs).
   * For Z/Y on inputs we still intercept, since the user expects
   * the global app-undo, not the input-level undo.
   */
  @HostListener('document:keydown', ['$event'])
  onKeydown(ev: KeyboardEvent): void {
    if (!(ev.ctrlKey || ev.metaKey)) return;
    const k = ev.key.toLowerCase();
    if (k === 'z' && !ev.shiftKey)               { ev.preventDefault(); this.undo(); }
    else if ((k === 'z' && ev.shiftKey) || k === 'y') { ev.preventDefault(); this.redo(); }
  }

  /** CDK drop on the canvas list. Two flows fold into one handler:
   *
   *   1. **Reorder** — drag came from the canvas itself. We just move
   *      the element within the array via `moveItemInArray`.
   *
   *   2. **Insert from palette** — drag came from the palette rail.
   *      The tile carries `{ type }` as its drag data; we build a
   *      fresh element of that type and splice it in at the drop
   *      index. The palette stays untouched (its tiles are a static
   *      catalogue, not a movable list), so we never call
   *      `transferArrayItem` — that would yank the tile out of the
   *      sidebar.
   */
  /** CDK sort predicate for the canvas drop list. Sorting is only
   *  meaningful for true canvas-to-canvas reorders — without this
   *  guard, dragging a palette tile OVER the canvas would push
   *  existing slots out of the way as the cursor moves, leaving
   *  the layout visually scrambled until drop. We restrict sort to
   *  drags whose source is the canvas itself; palette-to-canvas
   *  drops still work via the cross-list branch in
   *  `onElementsDrop`. */
  canvasSortPredicate = (_index: number, drag: { dropContainer: { id: string } }): boolean => {
    return drag.dropContainer.id === 'rbf-canvas';
  };

  onElementsDrop(event: CdkDragDrop<PrintElement[]>): void {
    if (event.previousContainer === event.container) {
      // Same list — reorder.
      if (event.previousIndex === event.currentIndex) return;
      this.captureBefore('Reorder elements', `reorder:${Date.now()}`);
      this.template.update((t) => {
        const next = [...t.recieptTemplate];
        moveItemInArray(next, event.previousIndex, event.currentIndex);
        return { ...t, recieptTemplate: next };
      });
      return;
    }

    // Cross-list drop — from the palette. The drag data carries the
    // palette tile id; look it up to find the right factory, then
    // splice a fresh element in at the drop position so the user
    // lands the new tile exactly where they let go.
    const data = event.item.data as { paletteId?: string } | undefined;
    const item = this.paletteItems.find((p) => p.id === data?.paletteId);
    if (!item) return;
    this.captureBefore(`Add ${item.id}`, `add:${Date.now()}`);
    const fresh = item.factory();
    this.template.update((t) => {
      const next = [...t.recieptTemplate];
      next.splice(event.currentIndex, 0, fresh);
      return { ...t, recieptTemplate: next };
    });
    this.selectedKey.set(fresh.__key ?? '');
  }

  /** Reorder triggered from the Elements (layers) panel. The panel
   *  has its own CDK drop list separate from the canvas's, so the
   *  drop event's `previousContainer` is the layers list — we can't
   *  reuse `onElementsDrop` directly (which would treat it as a
   *  cross-list drop and try to look up a palette tile). Same
   *  underlying mutation though. */
  onLayersReorder(event: CdkDragDrop<PrintElement[]>): void {
    if (event.previousIndex === event.currentIndex) return;
    this.captureBefore('Reorder elements', `reorder:${Date.now()}`);
    this.template.update((t) => {
      const next = [...t.recieptTemplate];
      moveItemInArray(next, event.previousIndex, event.currentIndex);
      return { ...t, recieptTemplate: next };
    });
  }

  // ─── Save / cancel ─────────────────────────────────────────────────────
  async save(): Promise<void> {
    if (!this.template().name.trim()) return;
    this.saving.set(true);
    try {
      const res = await this.service.save({
        ...this.template(),
        // Strip the local `__key` field before sending — purely a
        // client-side identity used by the canvas; no server need.
        recieptTemplate: this.template().recieptTemplate.map(({ __key, ...rest }) => rest as PrintElement),
      });
      if (res.success) {
        if (res.data) {
          this.template.set({
            ...res.data,
            recieptTemplate: parseElements(res.data.recieptTemplate),
          });
        }
        this.snapshot.set(JSON.stringify(this.template()));
        this.router.navigate(['/settings/receipt-builder']);
      }
    } finally {
      this.saving.set(false);
    }
  }

  async cancel(): Promise<void> {
    if (this.isDirty()) {
      const ok = await this.confirm({
        title:   this.translate.instant('COMMON.UNSAVED_TITLE'),
        message: this.translate.instant('COMMON.UNSAVED_HINT'),
        confirm: this.translate.instant('COMMON.LEAVE'),
        danger:  true,
      });
      if (!ok) return;
    }
    this.router.navigate(['/settings/receipt-builder']);
  }

  // ─── Helpers ───────────────────────────────────────────────────────────
  private async confirm(data: ConfirmModalData): Promise<boolean> {
    const ref = this.modal.open<ConfirmModalComponent, ConfirmModalData, boolean>(
      ConfirmModalComponent,
      { size: 'sm', data, closeOnBackdrop: false },
    );
    return (await ref.afterClosed()) === true;
  }

  trackElement = (_: number, e: PrintElement) => e.__key;
  trackPalette = (_: number, p: PaletteItem) => p.id;
  trackTemplate = (_: number, t: ReceiptTemplateSummary) => t.id;

  // ─── Templates quick-switcher actions ──────────────────────────────────
  /** Open / close the popover. First open lazily fetches the list so
   *  templates the user creates in another tab show up on next open.
   *  We refetch only if the cache is empty — explicit refresh isn't
   *  worth a UI control until users complain. */
  async toggleTemplatesMenu(): Promise<void> {
    const willOpen = !this.templatesMenuOpen();
    this.templatesMenuOpen.set(willOpen);
    if (!willOpen) return;
    this.templatesSearch.set('');
    if (this.templatesList().length === 0) {
      this.templatesLoading.set(true);
      try {
        const res = await this.service.getList({ page: 1, limit: 200 });
        this.templatesList.set(res.list);
      } finally {
        this.templatesLoading.set(false);
      }
    }
  }

  closeTemplatesMenu(): void {
    this.templatesMenuOpen.set(false);
  }

  /** Navigate to another template's editor. Same router target as the
   *  list page so the unsaved-changes guard kicks in automatically when
   *  the current template has dirty edits. */
  switchToTemplate(t: ReceiptTemplateSummary): void {
    this.closeTemplatesMenu();
    if (t.id === this.template().id) return;
    this.router.navigate(['/settings/receipt-builder', t.id]);
  }

  /** "+ New" entry in the popover footer — same flow as the list page's
   *  split add-menu. Closes the popover before navigating so the
   *  overlay backdrop disappears immediately. */
  newTemplate(type: TemplateType): void {
    this.closeTemplatesMenu();
    this.router.navigate(['/settings/receipt-builder', 'new'], { queryParams: { type } });
  }
}
