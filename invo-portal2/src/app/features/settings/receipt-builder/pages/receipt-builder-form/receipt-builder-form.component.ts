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
import { NgTemplateOutlet, CommonModule } from '@angular/common';
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
import {
  SegmentedToggleComponent,
  SegmentedToggleOption,
} from '@shared/components/segmented-toggle/segmented-toggle.component';
import { ElementEditorComponent } from './components/element-editor/element-editor.component';
import { ElementRenderComponent } from './components/element-render/element-render.component';
import { ElementsListComponent } from './components/elements-list/elements-list.component';
import { RbfWidgetComponent } from './components/rbf-widget/rbf-widget.component';
import { RbfWidgetCoordinator } from './components/rbf-widget/rbf-widget-coordinator.service';
import { ModalService } from '@shared/modal/modal.service';
import { ToastService } from '@shared/components/toast/toast.service';
import { SearchDropdownComponent } from '@shared/components/dropdown/search-dropdown.component';
import { ConfirmModalComponent, ConfirmModalData } from '@shared/modal/demo/confirm-modal.component';
import { CompanyService } from '@core/auth/company.service';

import { ReceiptBuilderService } from '../../services/receipt-builder.service';
import { elementFromWire, elementToWire } from '../../services/receipt-wire';
import { ElementContextMenuComponent, CtxItem } from './components/element-context-menu/element-context-menu.component';
import { invoiceToDemo } from '../../services/invoice-preview';
import { InvoicesService } from '../../../../account/invoices/services/invoices.service';
import type { DemoInvoice } from '../../services/binding-resolver';
import {
  PALETTE_ITEMS,
  ZATCA_PALETTE_ITEM,
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
    NgTemplateOutlet,
    OverlayModule,
    LoadingOverlayComponent,
    DesktopOnlyNoticeComponent,
    ElementEditorComponent,
    ElementRenderComponent,
    ElementsListComponent,
    RbfWidgetComponent,
    TooltipDirective,
    SegmentedToggleComponent,
    SearchDropdownComponent,
    ElementContextMenuComponent,
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
  private toast      = inject(ToastService);
  private invoices   = inject(InvoicesService);
  private route      = inject(ActivatedRoute);
  private modal      = inject(ModalService);
  private companies  = inject(CompanyService);
  private widgets    = inject(RbfWidgetCoordinator);

  loading = signal<boolean>(false);
  saving  = signal<boolean>(false);

  template = signal<ReceiptTemplate>(EMPTY_TEMPLATE('reciept'));
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

  /** Segmented-toggle options for the template-type switch (new
   *  templates only; the saved chip stays read-only). Labels are
   *  i18n keys piped through the toggle's `translate` pipe. */
  readonly templateTypeOptions: SegmentedToggleOption<TemplateType>[] = [
    { value: 'reciept', label: 'RECEIPT_BUILDER.TYPE_RECEIPT' },
    { value: 'kitchen',     label: 'RECEIPT_BUILDER.TYPE_KITCHEN' },
  ];

  /** Segmented-toggle options for the preview-profile picker —
   *  derived from `DEMO_PROFILES` so adding a new profile in the
   *  catalog automatically surfaces a tab here. */
  readonly previewProfileOptions: SegmentedToggleOption<string>[] =
    DEMO_PROFILES.map((p) => ({ value: p.id, label: `RECEIPT_BUILDER.DEMO.${p.labelKey}` }));
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
    const base0 = this.demoProfiles.find((p) => p.id === this.activeProfileId()) ?? this.demoProfiles[0];
    // A real invoice picked with "Choose an invoice" replaces the sample invoice (its branch details replace the sample's too).
    const real = this.previewInvoice();
    const br = this.previewBranch();
    const base: DemoProfile = real
      ? { ...base0, invoice: real, preferences: { ...base0.preferences, branchName: br.name || base0.preferences.branchName, branchAddress: br.address || base0.preferences.branchAddress, phoneNumber: br.phone || base0.preferences.phoneNumber } }
      : base0;
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

  /** The legacy builder adds the ZATCA QR tile only for Saudi Arabia companies. */
  // ── "Choose an invoice" (legacy preview picker) ─────────────────────────
  /** The invoice picked for the preview; null means the sample profile is shown. */
  previewInvoice = signal<DemoInvoice | null>(null);
  previewBranch = signal<{ name: string; address: string; phone: string }>({ name: '', address: '', phone: '' });
  pickedInvoice = signal<{ id: string; invoiceNumber: string } | null>(null);

  /** Same list the legacy picker loads: open / paid / closed / partially paid invoices, searchable, paged. */
  loadInvoices = async (p: { page: number; pageSize: number; search: string }) => {
    const d = await this.invoices.getInvoiceList({
      page: p.page, limit: p.pageSize, searchTerm: p.search,
      filter: { status: ['Open', 'Paid', 'Closed', 'Partially Paid'] },
    });
    return { items: d?.list ?? [], hasMore: p.page < (d?.pageCount ?? 1) };
  };
  invoiceLabel = (i: { invoiceNumber?: string } | null) => i?.invoiceNumber ?? '';
  invoiceCompare = (a: { id?: string } | null, b: { id?: string } | null) => (a?.id ?? null) === (b?.id ?? null);

  async onInvoicePicked(v: unknown): Promise<void> {
    const picked = (Array.isArray(v) ? v[0] : v) as { id: string; invoiceNumber: string } | null;
    this.pickedInvoice.set(picked ?? null);
    if (!picked?.id) { this.previewInvoice.set(null); return; }
    try {
      const inv: any = await this.invoices.getInvoice(picked.id);
      this.previewBranch.set({ name: inv.branchName ?? '', address: inv.branchAddress ?? '', phone: inv.branchPhone ?? '' });
      this.previewInvoice.set(invoiceToDemo(inv));
    } catch {
      this.toast.error('RECEIPT_BUILDER.DEMO.INVOICE_LOAD_FAILED');
      this.pickedInvoice.set(null);
      this.previewInvoice.set(null);
    }
  }

  readonly paletteItems = computed(() =>
    (this.companies.settings() as { country?: string } | null)?.country === 'Saudi Arabia'
      ? [...PALETTE_ITEMS, ZATCA_PALETTE_ITEM]
      : PALETTE_ITEMS);

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
    withTranslations('settings/receipt-builder');
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
      const layers = Number(localStorage.getItem(ReceiptBuilderFormComponent.LAYERS_KEY));
      if (Number.isFinite(layers) && layers > 0) {
        this.applyLayersWidth(Math.min(ReceiptBuilderFormComponent.LAYERS_MAX, Math.max(ReceiptBuilderFormComponent.LAYERS_MIN, layers)));
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
      this.template.set(DEFAULT_TEMPLATE(queryType === 'kitchen' ? 'kitchen' : 'reciept'));
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
        ? e.clientX
        : window.innerWidth - e.clientX;
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

  // ─── Layers column splitter ──────────────────────────────────────────
  // The Elements (layers) column next to the 64px tools strip can be resized the same way (`--rbf-layers-w`, remembered).
  private static readonly TOOLS_W    = 64;
  private static readonly LAYERS_MIN = 160;
  private static readonly LAYERS_MAX = 480;
  private static readonly LAYERS_KEY = 'rbf:layers-w';

  layersSplitterDragging = signal<boolean>(false);

  onLayersSplitterMouseDown(event: MouseEvent): void {
    event.preventDefault();
    this.layersSplitterDragging.set(true);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    const isRtl = getComputedStyle(document.documentElement).direction === 'rtl';
    const move = (e: MouseEvent) => {
      const raw = (isRtl ? window.innerWidth - e.clientX : e.clientX) - ReceiptBuilderFormComponent.TOOLS_W;
      this.applyLayersWidth(Math.min(ReceiptBuilderFormComponent.LAYERS_MAX, Math.max(ReceiptBuilderFormComponent.LAYERS_MIN, raw)));
    };
    const end = () => {
      this.layersSplitterDragging.set(false);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', end);
    };
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', end);
  }

  private applyLayersWidth(w: number): void {
    document.documentElement.style.setProperty('--rbf-layers-w', `${w}px`);
    try { localStorage.setItem(ReceiptBuilderFormComponent.LAYERS_KEY, String(w)); }
    catch { /* swallow */ }
  }

  /** Set the CSS variable + persist. Pulled out so both the restore
   *  path (ngOnInit) and the drag handler share one code path. */
  private applyRailWidth(w: number): void {
    document.documentElement.style.setProperty('--rbf-right-rail-w', `${w}px`);
    try { localStorage.setItem(ReceiptBuilderFormComponent.RAIL_KEY, String(w)); }
    catch { /* swallow */ }
  }

  /** Switch the new template's type (reciept ↔ kitchen). Always
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
    if (ev.key === 'Delete' && !this.isTypingTarget(ev.target)) {
      const sel = this.selectedElement();
      if (sel) { ev.preventDefault(); this.removeElement(sel); }
      return;
    }
    if (!(ev.ctrlKey || ev.metaKey)) return;
    const k = ev.key.toLowerCase();
    if (k === 'z' && !ev.shiftKey)               { ev.preventDefault(); this.undo(); }
    else if ((k === 'z' && ev.shiftKey) || k === 'y') { ev.preventDefault(); this.redo(); }
    else if (k === 'd' && !this.isTypingTarget(ev.target)) {
      const el = this.selectedElement();
      if (el) { ev.preventDefault(); this.duplicateElement(el); }
    }
    else if ((k === 'c' || k === 'v') && !this.isTypingTarget(ev.target) && !(k === 'c' && (window.getSelection()?.toString() ?? '') !== '')) {
      if (k === 'c') void this.copySelected(); else void this.pasteElement();
    }
    else if (k === 's') {
      ev.preventDefault();
      if (!this.saving() && !this.loading() && this.isDirty() && this.template().name.trim()) void this.save();
    }
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

  /** Id of the palette tile currently being dragged (drives the ghost tile that holds its place in the rail). */
  readonly draggingPalette = signal<string | null>(null);

  /** The palette is a fixed catalogue: nothing can be dropped into it, so its tiles never reorder or take canvas elements. */
  readonly never = (): boolean => false;

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
    const item = this.paletteItems().find((p) => p.id === data?.paletteId);
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
        this.toast.success('COMMON.SAVED_OK');
        this.router.navigate(['/settings/receipt-builder']);
      } else {
        this.toast.error('COMMON.SAVE_FAILED');
      }
    } catch (err: any) {
      this.toast.error('COMMON.SAVE_FAILED', err?.message);
      throw err;
    } finally {
      this.saving.set(false);
    }
  }

  private isTypingTarget(t: EventTarget | null): boolean {
    const el = t as HTMLElement | null;
    return !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable);
  }

  // ─── Right-click menu ────────────────────────────────────────────────
  /** Open menu: where it is and which options it offers (they depend on the element's type). */
  ctxMenu = signal<{ x: number; y: number; items: CtxItem[] } | null>(null);

  openContextMenu(ev: MouseEvent, el: PrintElement): void {
    ev.preventDefault();
    ev.stopPropagation();
    this.selectedKey.set(el.__key ?? '');
    this.ctxMenu.set({ x: ev.clientX, y: ev.clientY, items: this.buildCtxItems(el) });
  }

  closeContextMenu(): void { this.ctxMenu.set(null); }

  /** Move an element within the receipt. */
  moveElement(el: PrintElement, where: 'up' | 'down' | 'top' | 'bottom'): void {
    const len = this.template().recieptTemplate.length;
    const from = this.template().recieptTemplate.findIndex((e) => e.__key === el.__key);
    if (from < 0) return;
    const to = where === 'up' ? from - 1 : where === 'down' ? from + 1 : where === 'top' ? 0 : len - 1;
    if (to < 0 || to >= len || to === from) return;
    this.captureBefore('Move element', `move:${Date.now()}`);
    this.template.update((t) => {
      const next = [...t.recieptTemplate];
      moveItemInArray(next, from, to);
      return { ...t, recieptTemplate: next };
    });
  }

  /** The menu rows for one element: common actions, then what applies to its type, then ordering and delete. */
  private buildCtxItems(el: PrintElement): CtxItem[] {
    const c = (k: string) => this.translate.instant('RECEIPT_BUILDER.CTX.' + k);
    const patch = (key: string, value: unknown) => () => this.patchSelectedElement(key, value);
    const list = this.template().recieptTemplate;
    const idx = list.findIndex((e) => e.__key === el.__key);
    const e: any = el;

    const common: CtxItem[] = [
      { id: 'dup', label: c('DUPLICATE'), icon: 'duplicate', shortcut: 'Ctrl+D', run: () => this.duplicateElement(el) },
      { id: 'copy', label: c('COPY'), icon: 'copy', shortcut: 'Ctrl+C', run: () => void this.copySelected() },
      { id: 'paste', label: c('PASTE'), icon: 'paste', shortcut: 'Ctrl+V', run: () => void this.pasteElement() },
    ];

    const align = (values: [string, string, string]): CtxItem[] => [
      { id: 'al', label: c('ALIGN_LEFT'), icon: 'alignL', checked: e.alignment === values[0], run: patch('alignment', values[0]) },
      { id: 'ac', label: c('ALIGN_CENTER'), icon: 'alignC', checked: e.alignment === values[1], run: patch('alignment', values[1]) },
      { id: 'ar', label: c('ALIGN_RIGHT'), icon: 'alignR', checked: e.alignment === values[2], run: patch('alignment', values[2]) },
    ];
    const bold: CtxItem = { id: 'bold', label: c('BOLD'), icon: 'bold', checked: e.fontWeight === 'bold', run: patch('fontWeight', e.fontWeight === 'bold' ? 'normal' : 'bold') };
    const hidden = e.visibility === 'Hidden';
    const visibility: CtxItem = { id: 'vis', label: hidden ? c('SHOW') : c('HIDE'), icon: hidden ? 'eye' : 'eyeoff', run: patch('visibility', hidden ? 'Visible' : 'Hidden') };

    let specific: CtxItem[] = [];
    switch (el.type) {
      case 'Text':     specific = [...align(['Left', 'Center', 'Right']), bold, visibility]; break;
      case 'SideText': specific = [bold, visibility]; break;
      case 'QrCode':
      case 'Barcode':  specific = [visibility]; break;
      case 'Logo':
      case 'Image':    specific = align(['left', 'center', 'right']); break;
      case 'Line':
        specific = (['solid', 'dashed', 'dotted'] as const).map((s) => ({
          id: 'ls-' + s, label: c('LINE_' + s.toUpperCase()), icon: 'line', checked: e.style === s, run: patch('style', s),
        }));
        break;
      case 'Spacer':
        specific = [
          { id: 'taller', label: c('TALLER'), icon: 'plus', run: patch('height', num(e.height) + 10) },
          { id: 'shorter', label: c('SHORTER'), icon: 'minus', run: patch('height', Math.max(0, num(e.height) - 10)) },
        ];
        break;
      case 'Table':
        if (e.source === '!invoice.lines') {
          const opts = e.options ?? {};
          specific = [
            { id: 'o-opt', label: c('SHOW_OPTIONS'), icon: 'list', checked: opts.showOptions !== false, run: patch('options', { ...opts, showOptions: opts.showOptions === false }) },
            { id: 'o-price', label: c('SHOW_PRICE'), icon: 'list', checked: opts.showPrice !== false, run: patch('options', { ...opts, showPrice: opts.showPrice === false }) },
          ];
        }
        break;
    }

    const order: CtxItem[] = [
      { id: 'up', label: c('MOVE_UP'), icon: 'up', disabled: idx <= 0, run: () => this.moveElement(el, 'up') },
      { id: 'down', label: c('MOVE_DOWN'), icon: 'down', disabled: idx >= list.length - 1, run: () => this.moveElement(el, 'down') },
      { id: 'top', label: c('MOVE_TOP'), icon: 'top', disabled: idx <= 0, run: () => this.moveElement(el, 'top') },
      { id: 'bottom', label: c('MOVE_BOTTOM'), icon: 'bottom', disabled: idx >= list.length - 1, run: () => this.moveElement(el, 'bottom') },
    ];
    const del: CtxItem = { id: 'del', label: c('DELETE'), icon: 'trash', shortcut: 'Del', danger: true, run: () => this.removeElement(el) };

    const out: CtxItem[] = [...common];
    if (specific.length) out.push({ id: 'd1', divider: true }, ...specific);
    out.push({ id: 'd2', divider: true }, ...order, { id: 'd3', divider: true }, del);
    return out;
  }

  /** Last copied element (JSON). Kept in memory too, because the browser can refuse system clipboard access (insecure page,
   *  permission, focus in DevTools); copy and paste inside the editor must keep working then. */
  private elementClipboard: string | null = null;

  /** Legacy copy: the selected element goes to the clipboard as JSON (so it can also be pasted into another template). */
  async copySelected(): Promise<void> {
    const el = this.template().recieptTemplate.find((e) => e.__key === this.selectedKey());
    if (!el) return;
    const json = JSON.stringify(elementToWire({ ...el, id: '' }));
    this.elementClipboard = json;
    try { await navigator.clipboard?.writeText(json); } catch { /* the in-app copy above still works */ }
    this.toast.success('RECEIPT_BUILDER.CLIPBOARD.COPIED');
  }

  /** Legacy paste: a fresh element built from the clipboard JSON goes in after the selected element (or at the end). */
  async pasteElement(): Promise<void> {
    let text = '';
    try { text = (await navigator.clipboard?.readText()) ?? ''; } catch { /* fall back to the in-app copy */ }
    let data: any = null;
    for (const candidate of [text, this.elementClipboard ?? '']) {
      try { const v = JSON.parse(candidate); if (v && typeof v === 'object' && !Array.isArray(v) && typeof v.type === 'string') { data = v; break; } } catch { /* not an element */ }
    }
    if (!data) return;
    const [fresh] = parseElements([elementFromWire({ ...data, id: '', __key: undefined })]);
    if (!fresh) return;
    this.captureBefore(`Paste ${fresh.type}`, `paste:${Date.now()}`);
    this.template.update((tp) => {
      const next = [...tp.recieptTemplate];
      const at = next.findIndex((e) => e.__key === this.selectedKey());
      next.splice(at < 0 ? next.length : at + 1, 0, fresh);
      return { ...tp, recieptTemplate: next };
    });
    this.selectedKey.set(fresh.__key ?? '');
  }

  /** Download the elements as a plain JSON array, the same file the legacy builder exports. */
  exportJson(): void {
    const json = JSON.stringify(this.template().recieptTemplate.map(elementToWire));
    const a = document.createElement('a');
    a.href = 'data:text/json;charset=UTF-8,' + encodeURIComponent(json);
    a.download = 'receipt-template.json';
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  /** Opens the file picker; asks first when there are unsaved changes, as the legacy builder does. */
  async importJson(input: HTMLInputElement): Promise<void> {
    if (this.isDirty()) {
      const ok = await this.confirm({
        title:   this.translate.instant('COMMON.UNSAVED_TITLE'),
        message: this.translate.instant('RECEIPT_BUILDER.JSON.CONFIRM_REPLACE'),
        confirm: this.translate.instant('RECEIPT_BUILDER.JSON.IMPORT'),
        danger:  true,
      });
      if (!ok) return;
    }
    input.click();
  }

  onJsonFileSelected(ev: Event): void {
    const input = ev.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    const reset = () => { input.value = ''; };
    if (!file.name.toLowerCase().endsWith('.json')) { this.toast.error('RECEIPT_BUILDER.JSON.NOT_JSON'); reset(); return; }
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(String(reader.result));
        if (!Array.isArray(data) || data.length === 0) throw new Error('empty');
        const elements = parseElements(data.map(elementFromWire));
        this.captureBefore('Imported JSON template', `import:${Date.now()}`);
        this.template.update((t) => ({ ...t, recieptTemplate: elements }));
        this.selectedKey.set('');
        this.toast.success('RECEIPT_BUILDER.JSON.IMPORTED');
      } catch {
        this.toast.error('RECEIPT_BUILDER.JSON.INVALID');
      }
      reset();
    };
    reader.onerror = () => { this.toast.error('RECEIPT_BUILDER.JSON.INVALID'); reset(); };
    reader.readAsText(file);
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

function num(v: unknown): number { const n = Number(v); return Number.isFinite(n) ? n : 0; }
