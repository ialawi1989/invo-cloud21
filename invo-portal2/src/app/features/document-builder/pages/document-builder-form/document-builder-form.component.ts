import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  HostListener,
  OnInit,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

import { withTranslations } from '@core/i18n/with-translations';
import type { CanLeaveComponent } from '@core/guards/unsaved-changes.guard';
import { LoadingOverlayComponent } from '@shared/components/spinner/loading-overlay.component';
import { DesktopOnlyNoticeComponent } from '@shared/components/desktop-only-notice/desktop-only-notice.component';
import { TooltipDirective } from '@shared/directives/tooltip.directive';
import { ColorPickerComponent } from '@shared/components/color-picker/color-picker.component';
import { ModalService } from '@shared/modal/modal.service';
import { ConfirmModalComponent, ConfirmModalData } from '@shared/modal/demo/confirm-modal.component';

import { DocumentBuilderService } from '../../services/document-builder.service';
import {
  DEFAULT_TEMPLATE,
  DEFAULT_TEXT_STYLE,
  DOC_TYPE_TRANSACTIONAL_FIELDS,
  DocumentTemplate,
  DocumentType,
  RenderMode,
  TextStyle,
  TableColumn,
  Visibility,
  CompanyLogo,
  Margins,
  HeaderCustomization,
  FooterCustomization,
  AdditionalDataField,
  CustomElement,
  CustomFieldStyle,
  DesignerElement,
  TransactionalDetails,
  parseTemplate,
} from '../../services/document-template.types';
import { CustomFieldsService } from '@features/settings/services/custom-fields.service';
import type { CustomField } from '@features/settings/models/custom-field.types';
import { TextStyleEditorComponent } from './components/text-style-editor/text-style-editor.component';
import { BulkStyleEditorComponent, BulkStylePatch } from './components/bulk-style-editor/bulk-style-editor.component';
import { DesignerCanvasComponent } from './components/designer-canvas/designer-canvas.component';
import { DesignerInspectorComponent } from './components/designer-inspector/designer-inspector.component';
import { seedDesignerFromClassic } from './components/designer-canvas/sync-from-classic';
import { DocumentPaperComponent } from '@shared/components/document-paper/document-paper.component';
import {
  DropdownMenuBtnComponent,
  DropdownMenuBtnItem,
} from '@shared/components/dropdown-menu-btn/dropdown-menu-btn.component';
import { PAPER_LAYOUT, getDataModel, getFieldConfig, type TableColumnConfig } from '@shared/components/document-paper/paper-config';
import {
  SAMPLE_PROFILE_IDS,
  SAMPLE_PROFILES,
  type SampleProfileId,
} from '@shared/components/document-paper/sample-data';

/** A single undo/redo history entry — frozen JSON of the template
 *  plus a label so the (future) history dropdown can show what
 *  changed. The description is intentionally generic for now;
 *  per-edit descriptions can be wired through `pushSnapshot(...)`
 *  when patches start tagging themselves. */
interface HistoryEntry {
  snapshot:    string;
  timestamp:   number;
  description: string;
}

/** Left-nav tab descriptors (the 8 sections in the mockup). */
interface TabDef {
  id:    TabId;
  label: string;     // i18n key
  icon:  string;     // glyph id for the inline svg switch
}
type TabId =
  | 'general' | 'header-footer' | 'transaction' | 'table'
  | 'total'   | 'custom-fields' | 'other'      | 'elements';

const TABS: TabDef[] = [
  { id: 'general',       label: 'DOCUMENT_BUILDER.TAB.GENERAL',       icon: 'settings' },
  { id: 'header-footer', label: 'DOCUMENT_BUILDER.TAB.HEADER_FOOTER', icon: 'layout'   },
  { id: 'transaction',   label: 'DOCUMENT_BUILDER.TAB.TRANSACTION',   icon: 'file'     },
  { id: 'table',         label: 'DOCUMENT_BUILDER.TAB.TABLE',         icon: 'table'    },
  { id: 'total',         label: 'DOCUMENT_BUILDER.TAB.TOTAL',         icon: 'receipt'  },
  { id: 'custom-fields', label: 'DOCUMENT_BUILDER.TAB.CUSTOM_FIELDS', icon: 'edit'     },
  { id: 'other',         label: 'DOCUMENT_BUILDER.TAB.OTHER',         icon: 'more'     },
  { id: 'elements',      label: 'DOCUMENT_BUILDER.TAB.ELEMENTS',      icon: 'type'     },
];

/** Document types the user can pick when creating a new template
 *  (drives the title-bar segmented control). The legacy app spans
 *  all 7; phase 1 surfaces them all. Switching type on a NEW
 *  template resets the seeded transactional fields; on a SAVED
 *  template the type is locked. */
const DOC_TYPES: DocumentType[] = [
  'invoice', 'estimate', 'credit-note',
  'purchase-order', 'bill', 'expense', 'supplier-credit',
];

/**
 * DocumentBuilderFormComponent
 * ────────────────────────────
 * Phase 1 of the document-builder port. Provides the full form shell
 * (left-nav tabs + accordion config sidebar + canvas with Classic
 * paper preview) and wires up the most-used General + Header/Footer
 * panels. The other 6 tabs render placeholders pointing to the
 * follow-up phase.
 *
 * Data model is preserved 1:1 with the legacy `DocumentTemplate`
 * (see `document-template.types.ts`) so saved templates load here
 * without migration.
 *
 * `renderMode` is exposed as a top-bar selector — defaults to
 * `'classic'` for every saved template so phase 1 doesn't change
 * what the existing view/print pages render. Phase 2 adds the
 * Designer mode and wires it into the same surface.
 */
@Component({
  selector: 'app-document-builder-form',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    FormsModule,
    TranslateModule,
    LoadingOverlayComponent,
    DesktopOnlyNoticeComponent,
    TooltipDirective,
    TextStyleEditorComponent,
    BulkStyleEditorComponent,
    ColorPickerComponent,
    DesignerCanvasComponent,
    DesignerInspectorComponent,
    DocumentPaperComponent,
    DropdownMenuBtnComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './document-builder-form.component.html',
  styleUrl: './document-builder-form.component.scss',
})
export class DocumentBuilderFormComponent implements OnInit, CanLeaveComponent {
  private service    = inject(DocumentBuilderService);
  private translate  = inject(TranslateService);
  private destroyRef = inject(DestroyRef);
  private router     = inject(Router);
  private route      = inject(ActivatedRoute);
  private modal      = inject(ModalService);
  private cfService  = inject(CustomFieldsService);

  constructor() {
    // Load this feature's i18n bundle before the page renders.
    withTranslations('document-builder');

    // Capture every template change for undo/redo. The effect runs
    // synchronously after each `template.update(...)`; we debounce
    // 400ms before pushing so a stream of edits (typing in a label,
    // dragging a slider, picking a colour) collapses into one
    // history entry rather than dozens. The `lastSnapshotJson` field
    // dedupes — `undo()` / `redo()` update it before mutating the
    // template so they don't re-push their own work onto the stack.
    effect(() => {
      const t = this.template();
      const json = JSON.stringify(t);
      if (json === this.lastSnapshotJson) return;
      this.lastSnapshotJson = json;
      if (this.snapshotTimer !== null) clearTimeout(this.snapshotTimer);
      this.snapshotTimer = window.setTimeout(() => {
        this.pushSnapshot(json, 'Change');
        this.snapshotTimer = null;
      }, 400);
    });

    // URL state sync — every signal that the URL should reflect is
    // tracked here. Angular collects the deps automatically, so any
    // sub-tab toggle / zoom / sidebar drag / active-tab change kicks
    // this effect. We debounce 300ms so dragging the sidebar or
    // hammering a slider doesn't flood router.navigate (and the
    // browser history). The `urlSyncReady` flag suppresses writes
    // until after `ngOnInit` reads existing query params and seeds
    // the signals — otherwise the first run would clobber the
    // params the user came in with.
    effect(() => {
      const params = this.urlState();
      if (!this.urlSyncReady) return;
      if (this.urlSyncTimer !== null) clearTimeout(this.urlSyncTimer);
      this.urlSyncTimer = window.setTimeout(() => {
        this.urlSyncTimer = null;
        void this.router.navigate([], {
          relativeTo: this.route,
          queryParams: params,
          queryParamsHandling: 'merge',
          replaceUrl: true,
        });
      }, 300);
    });
  }

  // ─── State ───────────────────────────────────────────────────────────
  loading = signal<boolean>(false);
  saving  = signal<boolean>(false);

  /** Top-bar overflow menu (Reset / Export / Import). Closed on outside click. */
  moreMenuOpen = signal<boolean>(false);
  closeMoreMenu = () => this.moreMenuOpen.set(false);

  /** Items rendered in the toolbar's "..." `<app-dropdown-menu-btn>`.
   *  The Import item triggers a hidden file input owned by the
   *  template — `triggerImport()` clicks it programmatically so
   *  the item can stay a regular menu button. */
  moreMenuItems(): DropdownMenuBtnItem[] {
    return [
      { label: 'DOCUMENT_BUILDER.RESET',  click: () => this.resetToDefault() },
      { label: 'DOCUMENT_BUILDER.EXPORT', click: () => this.exportJson()     },
      { label: 'DOCUMENT_BUILDER.IMPORT', click: () => this.triggerImport()  },
    ];
  }

  /** Programmatically open the hidden file input. The file input
   *  itself lives in the template so its `(change)` handler still
   *  fires through Angular's bindings. */
  triggerImport(): void {
    const input = document.querySelector<HTMLInputElement>('#dbf-import-file-input');
    input?.click();
  }

  template = signal<DocumentTemplate>(DEFAULT_TEMPLATE('invoice'));

  /** Snapshot at last load/save — drives `isDirty`. */
  private snapshot = signal<string>('');

  /** Currently-selected left-nav tab. */
  activeTab = signal<TabId>('general');

  /** Right-sidebar accordion: which panel is expanded inside the
   *  current tab. Defaults flip per tab (e.g. opening Header/Footer
   *  starts on the Header panel; opening General starts on the
   *  Properties panel). */
  activePanel = signal<string>('properties');

  /** Canvas zoom (0.25 → 2.0). Persisted within the session only. */
  zoom = signal<number>(0.7);

  // ─── Undo / redo history ────────────────────────────────────────────
  // Stack-based history capped at 50 entries. Each entry is a JSON
  // serialization of the entire template at a point in time. The
  // effect in the constructor pushes a debounced snapshot on every
  // change; `undo()` / `redo()` swap entries between the two stacks
  // and apply the chosen snapshot to the template.
  private static readonly MAX_HISTORY = 50;

  undoStack = signal<HistoryEntry[]>([]);
  redoStack = signal<HistoryEntry[]>([]);

  /** Most recently captured template JSON. The effect compares
   *  against this to dedupe identical-content snapshots; `undo()`
   *  and `redo()` update it before mutating the template so the
   *  effect doesn't re-push their own work onto the stack. */
  private lastSnapshotJson = '';
  private snapshotTimer: number | null = null;

  // URL state sync state
  private urlSyncReady = false;
  private urlSyncTimer: number | null = null;

  canUndo = computed<boolean>(() => this.undoStack().length > 0);
  canRedo = computed<boolean>(() => this.redoStack().length > 0);

  // ─── Derived ─────────────────────────────────────────────────────────
  isDirty = computed<boolean>(
    () => JSON.stringify(this.template()) !== this.snapshot(),
  );

  isNewTemplate = computed<boolean>(() => !this.template().id);

  /** Available tabs, with their labels resolved at render time. */
  readonly tabs = TABS;
  readonly docTypes = DOC_TYPES;

  /** Localised heading: existing templates show their name, new ones
   *  show the i18n "New" string. */
  heading = computed<string>(() => {
    return this.template().id
      ? this.template().templateName || this.translate.instant('DOCUMENT_BUILDER.EDIT')
      : this.translate.instant('DOCUMENT_BUILDER.NEW');
  });

  // ─── Init ────────────────────────────────────────────────────────────
  ngOnInit(): void {
    // Restore saved sidebar width before the workspace lays out so
    // the panel doesn't flash from default to preference. The URL's
    // `sw` param wins over localStorage when both are present —
    // shareable links should reproduce the sender's layout exactly.
    this.restoreSidebarWidth();
    this.restoreUrlState(this.route.snapshot.queryParamMap);

    // Re-load whenever the route id changes (Templates picker reuses
    // this component when only `:id` flips).
    this.route.paramMap.pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((params) => {
        const id        = params.get('id') ?? 'new';
        const qp        = this.route.snapshot.queryParamMap;
        const queryType = (qp.get('type') ?? 'invoice') as DocumentType;
        const queryMode = qp.get('mode') as RenderMode | null;
        void this.loadTemplate(id, queryType, queryMode);
      });

    // Defer URL writes until the next macrotask so the initial signal
    // reads inside the URL effect don't fire a redundant write before
    // the user touches anything.
    queueMicrotask(() => { this.urlSyncReady = true; });
  }

  private async loadTemplate(id: string, queryType: DocumentType, queryMode: RenderMode | null): Promise<void> {
    if (id && id !== 'new') {
      this.loading.set(true);
      try {
        const loaded = await this.service.getById(queryType, id);
        if (loaded) this.template.set(loaded);
        else        this.template.set(DEFAULT_TEMPLATE(queryType));
      } finally {
        this.loading.set(false);
      }
    } else {
      // New template — honour the mode the user picked in the chooser.
      // Locked from this point forward; the form never exposes a
      // switcher in edit mode.
      const seed = DEFAULT_TEMPLATE(queryType);
      if (queryMode === 'classic' || queryMode === 'designer') {
        seed.renderMode = queryMode;
      }
      this.template.set(seed);
    }
    this.snapshot.set(JSON.stringify(this.template()));
    this.resetHistory();
    // Custom fields are fetched after the template lands so the
    // doc-type for entity CFs is final. The service caches per type,
    // so navigating between templates of the same type doesn't
    // re-hit the backend.
    void this.loadCustomFields();
  }

  hasUnsavedChanges(): boolean { return this.isDirty() && !this.saving(); }

  // ─── Undo / redo ────────────────────────────────────────────────────
  /** Push a snapshot onto the undo stack. Called from the change
   *  effect once the 400ms debounce settles. Identical-content
   *  pushes are skipped so no-op edits don't pollute the stack. */
  private pushSnapshot(json: string, description: string): void {
    const stack = this.undoStack();
    const last  = stack.length > 0 ? stack[stack.length - 1] : null;
    if (last && last.snapshot === json) return;
    const entry: HistoryEntry = { snapshot: json, timestamp: Date.now(), description };
    const next = [...stack, entry];
    if (next.length > DocumentBuilderFormComponent.MAX_HISTORY) next.shift();
    this.undoStack.set(next);
    // Any new edit invalidates the redo stack — you can't redo
    // forward through a branch that no longer exists.
    if (this.redoStack().length > 0) this.redoStack.set([]);
  }

  /** Restore the previous snapshot. The current template is moved
   *  onto the redo stack so the user can step forward again. */
  undo(): void {
    if (!this.canUndo()) return;
    const stack = this.undoStack();
    const top   = stack[stack.length - 1];
    const remaining = stack.slice(0, -1);
    const currentJson = JSON.stringify(this.template());
    // Push the current state to redo so a redo restores it.
    this.redoStack.update((r) => {
      const next = [...r, { snapshot: currentJson, timestamp: Date.now(), description: 'Undo' }];
      if (next.length > DocumentBuilderFormComponent.MAX_HISTORY) next.shift();
      return next;
    });
    this.undoStack.set(remaining);
    this.applyHistoryEntry(top);
  }

  redo(): void {
    if (!this.canRedo()) return;
    const stack = this.redoStack();
    const top   = stack[stack.length - 1];
    const remaining = stack.slice(0, -1);
    const currentJson = JSON.stringify(this.template());
    // Push the current state to undo so an undo brings it back.
    this.undoStack.update((u) => {
      const next = [...u, { snapshot: currentJson, timestamp: Date.now(), description: 'Redo' }];
      if (next.length > DocumentBuilderFormComponent.MAX_HISTORY) next.shift();
      return next;
    });
    this.redoStack.set(remaining);
    this.applyHistoryEntry(top);
  }

  /** Apply a history entry to the live template. Cancels any pending
   *  debounced snapshot and rebases `lastSnapshotJson` so the change
   *  effect doesn't immediately re-push the restored state. */
  private applyHistoryEntry(entry: HistoryEntry): void {
    if (this.snapshotTimer !== null) {
      clearTimeout(this.snapshotTimer);
      this.snapshotTimer = null;
    }
    this.lastSnapshotJson = entry.snapshot;
    this.template.set(JSON.parse(entry.snapshot) as DocumentTemplate);
  }

  /** Wipe both stacks. Called after `loadTemplate()` so the saved
   *  template (or freshly-defaulted new template) becomes the new
   *  baseline — the user can't undo past it. */
  private resetHistory(): void {
    if (this.snapshotTimer !== null) {
      clearTimeout(this.snapshotTimer);
      this.snapshotTimer = null;
    }
    this.undoStack.set([]);
    this.redoStack.set([]);
    this.lastSnapshotJson = JSON.stringify(this.template());
  }

  // ─── Keyboard shortcuts ─────────────────────────────────────────────
  // Ctrl+Z / Cmd+Z          → undo
  // Ctrl+Y / Ctrl+Shift+Z   → redo
  // Ctrl+S / Cmd+S          → save (always intercepted; otherwise the
  //                           browser opens "Save Page As")
  //
  // Ctrl+Z and Ctrl+Y are skipped when the focus is inside an input
  // / textarea / contenteditable element so the browser's native
  // text-level undo (typing) keeps working inside form fields.
  /** Close the top-bar overflow menu when the user clicks anywhere outside
   *  it. The trigger itself stops propagation so this only fires for
   *  off-menu clicks. */
  @HostListener('document:click')
  onDocumentClick(): void {
    if (this.moreMenuOpen()) this.moreMenuOpen.set(false);
  }

  @HostListener('document:keydown', ['$event'])
  onKeyDown(event: KeyboardEvent): void {
    const ctrlOrCmd = event.ctrlKey || event.metaKey;
    if (!ctrlOrCmd) return;

    const key = event.key.toLowerCase();

    if (key === 's') {
      event.preventDefault();
      if (!this.saving() && !this.loading() && this.isDirty() && this.template().templateName.trim()) {
        void this.save();
      }
      return;
    }

    // Don't fight native text-edit undo when the user is in a field.
    if (this.isEditableTarget(event.target)) return;

    if (key === 'z' && !event.shiftKey) {
      event.preventDefault();
      this.undo();
      return;
    }
    if ((key === 'y') || (key === 'z' && event.shiftKey)) {
      event.preventDefault();
      this.redo();
      return;
    }
  }

  private isEditableTarget(target: EventTarget | null): boolean {
    if (!(target instanceof HTMLElement)) return false;
    const tag = target.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
    if (target.isContentEditable) return true;
    return false;
  }

  // Browser-level reload / close protection is intentionally NOT
  // wired here — modern browsers replace any custom message with
  // their generic "Reload site?" dialog and we'd rather use the
  // app's own ConfirmModal everywhere. The Angular `canDeactivate`
  // guard catches in-app navigation; Reset & Cancel call
  // `confirmUnsavedChanges()` directly. Tab close / hard refresh
  // therefore drops unsaved edits silently — Save (Ctrl+S) is
  // always one click away.

  // ─── Top-level template field updates ───────────────────────────────
  patch<K extends keyof DocumentTemplate>(key: K, value: DocumentTemplate[K]): void {
    this.template.update((t) => ({ ...t, [key]: value }));
  }

  patchMargin(key: keyof Margins, value: number): void {
    this.template.update((t) => ({
      ...t,
      margins: { ...t.margins, [key]: value },
    }));
  }

  /** Read a margin value by key — wraps the index access so the
   *  template doesn't need an `$any` cast and the type system stays
   *  happy with `keyof Margins`. */
  marginValue(key: keyof Margins): string | number {
    return this.template().margins[key];
  }

  /** Static keys list — typed so the iteration in the template stays
   *  narrow (`keyof Margins` strictly) without needing a cast. */
  readonly marginKeys: ReadonlyArray<keyof Margins> = ['top', 'bottom', 'left', 'right'];

  patchHeader(patch: Partial<HeaderCustomization>): void {
    this.template.update((t) => ({
      ...t,
      headerCustomization: { ...t.headerCustomization, ...patch },
    }));
  }

  patchHeaderField(field: keyof HeaderCustomization, patch: Partial<TextStyle>): void {
    this.template.update((t) => {
      const current = t.headerCustomization[field] as TextStyle;
      return {
        ...t,
        headerCustomization: {
          ...t.headerCustomization,
          [field]: { ...current, ...patch },
        },
      };
    });
  }

  patchHeaderLogo(patch: Partial<CompanyLogo>): void {
    this.template.update((t) => ({
      ...t,
      headerCustomization: {
        ...t.headerCustomization,
        logo: { ...t.headerCustomization.logo, ...patch },
      },
    }));
  }

  patchHeaderVisibility(patch: Partial<Visibility>): void {
    this.template.update((t) => ({
      ...t,
      headerCustomization: {
        ...t.headerCustomization,
        visibility: { ...t.headerCustomization.visibility, ...patch },
      },
    }));
  }

  patchFooter(patch: Partial<FooterCustomization>): void {
    this.template.update((t) => ({
      ...t,
      footerCustomization: { ...t.footerCustomization, ...patch },
    }));
  }

  patchFooterField(field: 'noteTitle' | 'note' | 'customerNote' | 'term', patch: Partial<TextStyle>): void {
    this.template.update((t) => ({
      ...t,
      footerCustomization: {
        ...t.footerCustomization,
        [field]: { ...t.footerCustomization[field], ...patch },
      },
    }));
  }

  patchFooterVisibility(patch: Partial<Visibility>): void {
    this.template.update((t) => ({
      ...t,
      footerCustomization: {
        ...t.footerCustomization,
        visibility: { ...t.footerCustomization.visibility, ...patch },
      },
    }));
  }

  /** Patch the configurable page-number config — show toggle +
   *  position. The page number is independent from the document
   *  footer (notes / terms); when enabled, it renders below the
   *  pinned per-page footer in paginated print preview. */
  patchPageNumber(patch: Partial<{ show: boolean; position: 'left' | 'center' | 'right' }>): void {
    this.template.update((t) => ({
      ...t,
      footerCustomization: {
        ...t.footerCustomization,
        pageNumber: { ...t.footerCustomization.pageNumber, ...patch },
      },
    }));
  }

  // ─── Header / Footer panels: Fields | Layout sub-tab ────────────────
  // Mirrors the Table panel's two-tab pattern: Fields shows the
  // per-field show toggles (and gear-collapsed editors), Layout shows
  // a single Bulk-Style editor that broadcasts onto every field in
  // the section. Default is Fields — picking a font in Layout pushes
  // it to every field at once.
  headerActiveTab = signal<'fields' | 'layout'>('fields');
  footerActiveTab = signal<'fields' | 'layout'>('fields');

  setHeaderTab(tab: 'fields' | 'layout'): void { this.headerActiveTab.set(tab); }
  setFooterTab(tab: 'fields' | 'layout'): void { this.footerActiveTab.set(tab); }

  /** TextStyle keys on `HeaderCustomization` — everything except
   *  `logo` (CompanyLogo), `visibility`, and `customFields`. */
  private static readonly HEADER_TEXT_FIELDS: ReadonlyArray<keyof HeaderCustomization> = [
    'companyName', 'vatNumber', 'title', 'name', 'address', 'phone',
  ];
  private static readonly FOOTER_TEXT_FIELDS: ReadonlyArray<keyof FooterCustomization> = [
    'noteTitle', 'note', 'customerNote', 'term',
  ];

  /** Apply a `BulkStylePatch` onto every TextStyle field in the
   *  header section. Only the keys present in `p` are written —
   *  fields keep their existing values for any keys the user didn't
   *  touch. The cast through `Record<string, TextStyle>` sidesteps
   *  the type-narrowing of `HeaderCustomization[K]` (which spans
   *  TextStyle, CompanyLogo, Visibility, …); we only ever touch the
   *  pre-screened TextStyle keys in `HEADER_TEXT_FIELDS`. */
  patchAllHeaderFields(p: BulkStylePatch): void {
    this.template.update((t) => {
      const next = { ...t.headerCustomization } as unknown as Record<string, TextStyle>;
      for (const key of DocumentBuilderFormComponent.HEADER_TEXT_FIELDS) {
        next[key as string] = this.applyBulkPatch(next[key as string], p);
      }
      return { ...t, headerCustomization: next as unknown as HeaderCustomization };
    });
  }

  patchAllFooterFields(p: BulkStylePatch): void {
    this.template.update((t) => {
      const next = { ...t.footerCustomization } as unknown as Record<string, TextStyle>;
      for (const key of DocumentBuilderFormComponent.FOOTER_TEXT_FIELDS) {
        next[key as string] = this.applyBulkPatch(next[key as string], p);
      }
      return { ...t, footerCustomization: next as unknown as FooterCustomization };
    });
  }

  /** Apply a BulkStylePatch's keys onto a TextStyle. Skips keys the
   *  patch doesn't carry so unrelated fields stay untouched. */
  private applyBulkPatch(cur: TextStyle, p: BulkStylePatch): TextStyle {
    return {
      ...cur,
      ...(p.size            !== undefined ? { size:            p.size            } : {}),
      ...(p.color           !== undefined ? { color:           p.color           } : {}),
      ...(p.backgroundColor !== undefined ? { backgroundColor: p.backgroundColor } : {}),
      ...(p.bold            !== undefined ? { bold:            p.bold            } : {}),
      ...(p.italic          !== undefined ? { italic:          p.italic          } : {}),
      ...(p.underline       !== undefined ? { underline:       p.underline       } : {}),
      ...(p.alignment       !== undefined ? { alignment:       p.alignment       } : {}),
    };
  }

  /** "Representative" value for the bulk editor — picks the value of
   *  the first visible (or any) field as the pre-filled starting
   *  point so the user sees a sensible default rather than empty
   *  inputs. Header and Footer both use a dedicated computed so the
   *  template stays declarative. */
  bulkHeaderRepresentative = computed<TextStyle>(() => {
    const h = this.template().headerCustomization;
    const visible = DocumentBuilderFormComponent.HEADER_TEXT_FIELDS
      .map((k) => h[k] as TextStyle)
      .find((v) => v?.show);
    return visible ?? (h.companyName as TextStyle) ?? DEFAULT_TEXT_STYLE();
  });

  bulkFooterRepresentative = computed<TextStyle>(() => {
    const f = this.template().footerCustomization;
    const visible = DocumentBuilderFormComponent.FOOTER_TEXT_FIELDS
      .map((k) => f[k] as TextStyle)
      .find((v) => v?.show);
    return visible ?? (f.note as TextStyle) ?? DEFAULT_TEXT_STYLE();
  });

  // ─── Total panel: Fields | Layout sub-tab ───────────────────────────
  // The Total Section and Payment Table both ship a Layout sub-tab so
  // the user can re-style every row in the panel at once (font size,
  // colour, B/I/U). Single source of truth for the totals' visual
  // identity — picking 12pt on Layout makes every total row 12pt.
  totalActiveTab   = signal<'fields' | 'layout'>('fields');
  paymentActiveTab = signal<'fields' | 'layout'>('fields');

  setTotalTab(tab: 'fields' | 'layout'):   void { this.totalActiveTab.set(tab); }
  setPaymentTab(tab: 'fields' | 'layout'): void { this.paymentActiveTab.set(tab); }

  private static readonly TOTAL_TABLE_FIELDS = [
    'itemTotal', 'taxTotal', 'discount', 'charge',
    'delevary', 'roundingTotal', 'subTotal', 'Total',
  ] as const;
  private static readonly PAYMENT_TABLE_FIELDS = [
    'payments', 'paymentMethods', 'credit', 'balance',
  ] as const;

  patchAllTotalFields(p: BulkStylePatch): void {
    this.template.update((t) => {
      const tt = { ...t.totalSectionCustomization.totalTable };
      // Background colour patches the table background, not the
      // individual fields' background — that's how the legacy
      // surface treats it.
      if (p.backgroundColor !== undefined) tt.backgroundColor = p.backgroundColor;
      for (const key of DocumentBuilderFormComponent.TOTAL_TABLE_FIELDS) {
        const cur = (tt as unknown as Record<string, TextStyle>)[key];
        (tt as unknown as Record<string, TextStyle>)[key] = this.applyBulkPatch(cur, p);
      }
      return {
        ...t,
        totalSectionCustomization: { ...t.totalSectionCustomization, totalTable: tt },
      };
    });
  }

  patchAllPaymentFields(p: BulkStylePatch): void {
    this.template.update((t) => {
      const pt = { ...t.totalSectionCustomization.paymentTable };
      if (p.backgroundColor !== undefined) pt.backgroundColor = p.backgroundColor;
      for (const key of DocumentBuilderFormComponent.PAYMENT_TABLE_FIELDS) {
        const cur = (pt as unknown as Record<string, TextStyle>)[key];
        (pt as unknown as Record<string, TextStyle>)[key] = this.applyBulkPatch(cur, p);
      }
      return {
        ...t,
        totalSectionCustomization: { ...t.totalSectionCustomization, paymentTable: pt },
      };
    });
  }

  bulkTotalRepresentative = computed<TextStyle>(() => {
    const tt = this.template().totalSectionCustomization.totalTable;
    return (tt.Total ?? tt.subTotal ?? tt.itemTotal) as TextStyle;
  });

  bulkPaymentRepresentative = computed<TextStyle>(() => {
    const pt = this.template().totalSectionCustomization.paymentTable;
    return (pt.payments ?? pt.balance) as TextStyle;
  });

  bulkTotalBackground = computed<string>(
    () => this.template().totalSectionCustomization.totalTable.backgroundColor || ''
  );
  bulkPaymentBackground = computed<string>(
    () => this.template().totalSectionCustomization.paymentTable.backgroundColor || ''
  );

  // ─── URL state ──────────────────────────────────────────────────────
  // Compact param shape the builder writes to the URL on every UI
  // state change so a teammate can paste a link and see the same
  // tab / sub-view / zoom / sidebar width. Mirrors the legacy
  // builder's URL contract (tab / hv / fv / cv / dv / tv / totv /
  // pv / cfbv / cfev / z / sw). Empty / default values are mapped
  // to `null` so they drop out of the URL — the URL reads cleanly
  // on a fresh template and only grows when the user diverges.
  urlState = computed<Record<string, string | number | null>>(() => {
    const sw = this.sidebarWidth();
    return {
      tab:  this.activeTab(),
      hv:   this.headerActiveTab()   === 'layout' ? 'l' : null,
      fv:   this.footerActiveTab()   === 'layout' ? 'l' : null,
      cv:   this.customerActiveTab() === 'layout' ? 'l' : null,
      dv:   this.documentActiveTab() === 'layout' ? 'l' : null,
      tv:   this.tableActiveTab()    === 'style'  ? 's' : null,
      totv: this.totalActiveTab()    === 'layout' ? 'l' : null,
      pv:   this.paymentActiveTab()  === 'layout' ? 'l' : null,
      cfbv: this.cfBranchActiveTab() === 'layout' ? 'l' : null,
      cfev: this.cfEntityActiveTab() === 'layout' ? 'l' : null,
      z:    Math.round(this.zoom() * 100),
      sw:   sw,
    };
  });

  /** Apply incoming query params to the in-memory state. Called
   *  once on init before `urlSyncReady` flips so the first effect
   *  run picks up the user's URL rather than clobbering it. */
  private restoreUrlState(qp: import('@angular/router').ParamMap): void {
    const tab = qp.get('tab');
    if (tab && this.tabs.some((t) => t.id === tab)) {
      this.activeTab.set(tab as TabId);
    }
    if (qp.get('hv')   === 'l') this.headerActiveTab.set('layout');
    if (qp.get('fv')   === 'l') this.footerActiveTab.set('layout');
    if (qp.get('cv')   === 'l') this.customerActiveTab.set('layout');
    if (qp.get('dv')   === 'l') this.documentActiveTab.set('layout');
    if (qp.get('tv')   === 's') this.tableActiveTab.set('style');
    if (qp.get('totv') === 'l') this.totalActiveTab.set('layout');
    if (qp.get('pv')   === 'l') this.paymentActiveTab.set('layout');
    if (qp.get('cfbv') === 'l') this.cfBranchActiveTab.set('layout');
    if (qp.get('cfev') === 'l') this.cfEntityActiveTab.set('layout');
    const z = Number(qp.get('z'));
    if (Number.isFinite(z) && z >= 25 && z <= 200) this.zoom.set(z / 100);
    const sw = Number(qp.get('sw'));
    if (Number.isFinite(sw) &&
        sw >= DocumentBuilderFormComponent.SIDEBAR_MIN &&
        sw <= DocumentBuilderFormComponent.SIDEBAR_MAX) {
      this.applySidebarWidth(sw);
    }
  }

  // ─── Custom fields panel ────────────────────────────────────────────
  // Fetched once per session via the shared `CustomFieldsService`. The
  // service maintains its own cache so re-opening the builder doesn't
  // re-hit the backend. Soft-deleted CFs are filtered out so the
  // editor only surfaces fields the tenant currently uses.
  branchCustomFields = signal<CustomField[]>([]);
  entityCustomFields = signal<CustomField[]>([]);

  /** Whether the current document type exposes its own entity CFs.
   *  Read from the doc type's `dataModel.cfEntityType` — `null`
   *  means the doc type piggybacks on another scope (credit-note on
   *  invoice, supplier-credit on bill) and the entity-CF section is
   *  hidden in the form. */
  hasEntityCustomFields = computed<boolean>(
    () => this.dataModel()?.cfEntityType != null,
  );

  private async loadCustomFields(): Promise<void> {
    const dm = this.dataModel();
    const entityKey = dm?.cfEntityType ?? null;
    const [branch, entity] = await Promise.all([
      this.cfService.getByType('branch').catch(() => [] as CustomField[]),
      entityKey ? this.cfService.getByType(entityKey).catch(() => [] as CustomField[]) : Promise.resolve([] as CustomField[]),
    ]);
    this.branchCustomFields.set(branch.filter((f) => !f.isDeleted));
    this.entityCustomFields.set(entity.filter((f) => !f.isDeleted));
  }

  /** Read the CustomFieldStyle entry for a given CF abbr, falling
   *  back to a fresh default when the user hasn't customised it yet.
   *  `scope` decides which template array to read — branch CFs live
   *  on the header, entity CFs on the transactional details. */
  cfStyle(scope: 'branch' | 'entity', cf: CustomField): TextStyle {
    const list = scope === 'branch'
      ? this.template().headerCustomization.customFields
      : (this.template().transactionalDetailsCustomization.customFields ?? []);
    const found = list.find((e) => e.abbr === cf.abbr);
    return found?.style ?? DEFAULT_TEXT_STYLE({ size: 10 });
  }

  /** Patch a single CF's style. Inserts an entry if missing, merges
   *  on top if present. */
  patchCustomFieldStyle(scope: 'branch' | 'entity', cf: CustomField, style: TextStyle): void {
    this.template.update((t) => {
      if (scope === 'branch') {
        const list = [...t.headerCustomization.customFields];
        const idx = list.findIndex((e) => e.abbr === cf.abbr);
        const next: CustomFieldStyle = { abbr: cf.abbr, name: cf.name, style };
        if (idx >= 0) list[idx] = next; else list.push(next);
        return { ...t, headerCustomization: { ...t.headerCustomization, customFields: list } };
      }
      const list = [...(t.transactionalDetailsCustomization.customFields ?? [])];
      const idx = list.findIndex((e) => e.abbr === cf.abbr);
      const next: CustomFieldStyle = { abbr: cf.abbr, name: cf.name, style };
      if (idx >= 0) list[idx] = next; else list.push(next);
      return {
        ...t,
        transactionalDetailsCustomization: {
          ...t.transactionalDetailsCustomization,
          customFields: list,
        },
      };
    });
  }

  trackCustomField = (_: number, f: CustomField) => f.id || f.abbr;

  // Custom Fields panel: Fields | Layout sub-tab. Same pattern as
  // every other styled panel — Layout broadcasts a single patch
  // onto every CF in the scope (branch or entity) at once.
  cfBranchActiveTab = signal<'fields' | 'layout'>('fields');
  cfEntityActiveTab = signal<'fields' | 'layout'>('fields');

  setCfBranchTab(tab: 'fields' | 'layout'): void { this.cfBranchActiveTab.set(tab); }
  setCfEntityTab(tab: 'fields' | 'layout'): void { this.cfEntityActiveTab.set(tab); }

  patchAllBranchCustomFields(p: BulkStylePatch): void {
    this.template.update((t) => {
      const list = (t.headerCustomization.customFields ?? []).map((e) => ({
        ...e,
        style: this.applyBulkPatch(e.style, p),
      }));
      // Also apply to fetched CFs that don't yet have a row in the
      // template — this is the "first-time bulk style" gesture: it
      // creates entries for every visible CF using the bulk patch as
      // the seed style.
      const known = new Set(list.map((e) => e.abbr));
      for (const cf of this.branchCustomFields()) {
        if (known.has(cf.abbr)) continue;
        list.push({
          abbr: cf.abbr, name: cf.name,
          style: this.applyBulkPatch(DEFAULT_TEXT_STYLE({ size: 10 }), p),
        });
      }
      return { ...t, headerCustomization: { ...t.headerCustomization, customFields: list } };
    });
  }

  patchAllEntityCustomFields(p: BulkStylePatch): void {
    this.template.update((t) => {
      const list = (t.transactionalDetailsCustomization.customFields ?? []).map((e) => ({
        ...e,
        style: this.applyBulkPatch(e.style, p),
      }));
      const known = new Set(list.map((e) => e.abbr));
      for (const cf of this.entityCustomFields()) {
        if (known.has(cf.abbr)) continue;
        list.push({
          abbr: cf.abbr, name: cf.name,
          style: this.applyBulkPatch(DEFAULT_TEXT_STYLE({ size: 10 }), p),
        });
      }
      return {
        ...t,
        transactionalDetailsCustomization: {
          ...t.transactionalDetailsCustomization,
          customFields: list,
        },
      };
    });
  }

  /** Pre-fill the bulk editor with the first CF's style — falls back
   *  to a plain default when no CFs are styled yet. */
  bulkBranchCFRepresentative = computed<TextStyle>(() => {
    const list = this.template().headerCustomization.customFields ?? [];
    return list[0]?.style ?? DEFAULT_TEXT_STYLE({ size: 10 });
  });
  bulkEntityCFRepresentative = computed<TextStyle>(() => {
    const list = this.template().transactionalDetailsCustomization.customFields ?? [];
    return list[0]?.style ?? DEFAULT_TEXT_STYLE({ size: 10 });
  });

  // ─── Tab + accordion navigation ─────────────────────────────────────
  selectTab(id: TabId): void {
    this.activeTab.set(id);
    // Sensible default panel per tab so the first accordion item is
    // open when the user lands.
    const defaults: Record<TabId, string> = {
      'general':       'properties',
      'header-footer': 'header',
      'transaction':   'customer-details',
      'table':         'columns',
      'total':         'total-table',
      'custom-fields': 'cf-branch',
      'other':         'additional',
      'elements':      'palette',
    };
    this.activePanel.set(defaults[id]);
  }

  togglePanel(panelId: string): void {
    this.activePanel.update((current) => current === panelId ? '' : panelId);
  }

  // ─── Document-type switcher (new templates only) ────────────────────
  async switchDocumentType(next: DocumentType): Promise<void> {
    if (next === this.template().documentType) return;
    if (!this.isNewTemplate()) return;
    const ok = await this.confirm({
      title:   this.translate.instant('DOCUMENT_BUILDER.SWITCH_TYPE_TITLE'),
      message: this.translate.instant('DOCUMENT_BUILDER.SWITCH_TYPE_MESSAGE'),
      confirm: this.translate.instant('DOCUMENT_BUILDER.SWITCH_TYPE_CONFIRM'),
      danger:  true,
    });
    if (!ok) return;
    this.template.set(DEFAULT_TEMPLATE(next));
    this.snapshot.set(JSON.stringify(this.template()));
  }

  // ─── Print preview / print ──────────────────────────────────────────
  /** When true, the canvas swaps the single-paper preview for a
   *  stacked-A4-pages preview ("Word/PDF viewer style"). The
   *  document-paper renders with its `[printPreview]="true"` flag,
   *  which paginates items, repeats the company header on every
   *  page, and keeps the totals / payments / customer-balance /
   *  signature / customer-note tail atomic on the last page.
   *  `window.print()` (Ctrl+S) prints exactly the visible DOM, so
   *  the on-screen preview is what the printer produces. */
  printPreviewMode = signal<boolean>(false);

  togglePrintPreview(): void {
    this.printPreviewMode.update((v) => !v);
  }

  /** Open the browser's native print dialog. The form's `@media
   *  print` rules + the paginated DOM (when preview mode is on)
   *  make the printed pages match the on-screen preview. */
  print(): void {
    // If the user clicks Print while in edit mode, flip into preview
    // first so the print output shows the paginated layout. Wait a
    // microtask for Angular to render the new view before triggering
    // the print dialog — otherwise the browser reads the old DOM.
    if (!this.printPreviewMode()) {
      this.printPreviewMode.set(true);
      queueMicrotask(() => window.print());
      return;
    }
    window.print();
  }

  // ─── Zoom ────────────────────────────────────────────────────────────
  zoomIn():    void { this.zoom.update((z) => Math.min(2,    z + 0.1)); }
  zoomOut():   void { this.zoom.update((z) => Math.max(0.25, z - 0.1)); }
  zoomFit():   void { this.zoom.set(0.7); }
  zoom100():   void { this.zoom.set(1);   }

  // ─── Save / cancel / reset ──────────────────────────────────────────
  async save(): Promise<void> {
    if (this.saving()) return;
    if (!this.template().templateName.trim()) return;
    this.saving.set(true);
    try {
      const saved = await this.service.save(this.template());
      if (saved) {
        this.template.set(saved);
        this.snapshot.set(JSON.stringify(saved));
        // The saved template becomes the new history baseline — the
        // user can't undo past a successful save.
        this.resetHistory();
        // First-save: switch the URL from /new to /:id so a refresh
        // reloads the same template.
        if (saved.id) {
          void this.router.navigate(['../', saved.id], {
            relativeTo: this.route,
            queryParamsHandling: 'preserve',
          });
        }
      }
    } finally {
      this.saving.set(false);
    }
  }

  async resetToDefault(): Promise<void> {
    const ok = await this.confirm({
      title:   this.translate.instant('DOCUMENT_BUILDER.RESET_TITLE'),
      message: this.translate.instant('DOCUMENT_BUILDER.RESET_MESSAGE'),
      danger:  true,
    });
    if (!ok) return;
    const fresh = DEFAULT_TEMPLATE(this.template().documentType);
    fresh.id           = this.template().id;
    fresh.templateName = this.template().templateName;
    this.template.set(fresh);
  }

  cancel(): void {
    void this.router.navigate(['/settings/document-builder'], {
      queryParams: { type: this.template().documentType },
    });
  }

  // ─── JSON import / export (matches the mockup) ──────────────────────
  exportJson(): void {
    try {
      const payload = {
        version: 1,
        exportedAt: new Date().toISOString(),
        template: this.template(),
      };
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      const safe = (this.template().templateName || 'template')
        .replace(/[^a-z0-9_-]+/gi, '_').toLowerCase();
      a.href     = url;
      a.download = `${safe}-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Document export failed', err);
    }
  }

  onImportFile(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file  = input.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const parsed = JSON.parse(e.target?.result as string);
        if (!parsed || typeof parsed !== 'object') throw new Error('Invalid JSON');
        // Support both { version, template } envelope and a raw
        // template object so users can paste either shape.
        const raw = parsed.template ?? parsed;
        const restored = parseTemplate(raw, this.template().documentType);
        // Preserve the current id so an import doesn't accidentally
        // create a new server record.
        restored.id = this.template().id;
        this.template.set(restored);
      } catch (err) {
        console.error('Document import failed', err);
      } finally {
        input.value = ''; // re-allow re-importing the same file
      }
    };
    reader.readAsText(file);
  }

  // ─── Helpers ────────────────────────────────────────────────────────
  private async confirm(data: ConfirmModalData): Promise<boolean> {
    const ref = this.modal.open<ConfirmModalComponent, ConfirmModalData, boolean>(
      ConfirmModalComponent,
      { size: 'sm', data, closeOnBackdrop: false },
    );
    return (await ref.afterClosed()) === true;
  }

  trackTab = (_: number, t: TabDef) => t.id;
  trackType = (_: number, t: string) => t;

  // Make text-style cast easier in the template.
  asText(v: TextStyle): TextStyle { return v; }

  // ─── Transaction panel ──────────────────────────────────────────────
  /** Field ids relevant to the current document type — used to drive
   *  the Transaction panel's editor list. Order is preserved. */
  transactionalFields = computed<string[]>(() => {
    return DOC_TYPE_TRANSACTIONAL_FIELDS[this.template().documentType] ?? [];
  });

  /** Common fields surfaced for every type (rendered above the
   *  type-specific list). */
  readonly commonTransactionalFields = ['tableTitle', 'taxType', 'barcode'];

  /** Table chrome ids — these live in the transactional details map
   *  (legacy persistence layout) but are configured in the *Table*
   *  panel, not Transaction. We strip them out when listing fields
   *  for Customer Details / Document Details panels. */
  private static readonly TABLE_CHROME_FIELD_RE = /TableHeader$|Lines$|VoidedLines$/;

  /** Customer / supplier identifiers — render in the Customer
   *  Details panel. Anything beginning with `customer` or `supplier`,
   *  plus the two staff fields. */
  private static readonly CUSTOMER_FIELD_RE = /^(customer|supplier)/;
  private static readonly STAFF_FIELDS = new Set<string>(['salesPerson', 'employeeName']);

  /** Customer-side fields for the active doc type (drives the
   *  Customer Details panel). */
  customerFieldIds = computed<string[]>(() => {
    return this.transactionalFields().filter((id) =>
      DocumentBuilderFormComponent.CUSTOMER_FIELD_RE.test(id) ||
      DocumentBuilderFormComponent.STAFF_FIELDS.has(id),
    );
  });

  /** Document-level fields — everything that's not customer-side
   *  and not table chrome. Renders in the Document Details panel. */
  documentFieldIds = computed<string[]>(() => {
    return this.transactionalFields().filter((id) => {
      if (DocumentBuilderFormComponent.TABLE_CHROME_FIELD_RE.test(id)) return false;
      if (DocumentBuilderFormComponent.CUSTOMER_FIELD_RE.test(id)) return false;
      if (DocumentBuilderFormComponent.STAFF_FIELDS.has(id)) return false;
      return true;
    });
  });

  // Customer Details / Document Details: Fields | Layout sub-tab
  customerActiveTab = signal<'fields' | 'layout'>('fields');
  documentActiveTab = signal<'fields' | 'layout'>('fields');

  setCustomerTab(tab: 'fields' | 'layout'): void { this.customerActiveTab.set(tab); }
  setDocumentTab(tab: 'fields' | 'layout'): void { this.documentActiveTab.set(tab); }

  /** Bulk-style apply: spread a `BulkStylePatch` onto every field in
   *  the panel's id list. Same machinery as the header / footer /
   *  total / payment bulk apply — uses the shared `applyBulkPatch`
   *  helper so visibility (`show`) and label override (`label`) are
   *  preserved on each row. */
  patchAllCustomerFields(p: BulkStylePatch): void {
    this.patchAllTransactionalFields(this.customerFieldIds(), p);
  }
  patchAllDocumentFields(p: BulkStylePatch): void {
    this.patchAllTransactionalFields(this.documentFieldIds(), p);
  }

  private patchAllTransactionalFields(ids: ReadonlyArray<string>, p: BulkStylePatch): void {
    this.template.update((t) => {
      const next = { ...t.transactionalDetailsCustomization } as TransactionalDetails;
      for (const id of ids) {
        const cur = next[id] as TextStyle | undefined;
        if (!cur || typeof cur !== 'object' || !('show' in cur)) continue;
        next[id] = this.applyBulkPatch(cur, p);
      }
      return { ...t, transactionalDetailsCustomization: next };
    });
  }

  /** Pre-fill values for the Layout bulk editor — picks the first
   *  visible field's TextStyle (or the first field, period) so the
   *  user starts from a sensible representative state. */
  bulkCustomerRepresentative = computed<TextStyle>(() => {
    const ids = this.customerFieldIds();
    return this.firstVisibleField(ids) ?? DEFAULT_TEXT_STYLE({ size: 10 });
  });
  bulkDocumentRepresentative = computed<TextStyle>(() => {
    const ids = this.documentFieldIds();
    return this.firstVisibleField(ids) ?? DEFAULT_TEXT_STYLE({ size: 10 });
  });

  private firstVisibleField(ids: ReadonlyArray<string>): TextStyle | null {
    const td = this.template().transactionalDetailsCustomization;
    for (const id of ids) {
      const v = td[id] as TextStyle | undefined;
      if (v && typeof v === 'object' && 'show' in v && v.show) return v;
    }
    // No visible field — return the first field's style anyway so
    // the editor inputs don't start blank.
    for (const id of ids) {
      const v = td[id] as TextStyle | undefined;
      if (v && typeof v === 'object' && 'show' in v) return v;
    }
    return null;
  }

  /** Read a transactional TextStyle by field name. Returns a default
   *  if the field is missing (defensive — lets us add new fields
   *  client-side ahead of the server). */
  transactionalField(fieldId: string): TextStyle {
    const v = this.template().transactionalDetailsCustomization[fieldId] as TextStyle | undefined;
    return v && typeof v === 'object' && 'show' in v ? v : DEFAULT_TEXT_STYLE({ size: 10 });
  }

  /** Read the field-level config for a transactional field id. Drives
   *  the per-field editor's `[required]` / `[showLabel]` inputs from
   *  the registry rather than hard-coding either at every call site.
   *  Returns null for fields that aren't in firstColumn / secondColumn
   *  (table chrome ids); callers fall back to defaults. */
  fieldConfig(fieldId: string) {
    return getFieldConfig(this.template().documentType, fieldId);
  }

  /** True when the field is marked `required: true` in the registry. */
  isFieldRequired(fieldId: string): boolean {
    return this.fieldConfig(fieldId)?.required === true;
  }

  /** True when the field's label can be renamed by the user.
   *  Defaults to true unless the registry explicitly opts out
   *  (`editable: false`). */
  isFieldEditable(fieldId: string): boolean {
    return this.fieldConfig(fieldId)?.editable !== false;
  }

  patchTransactionalField(fieldId: string, value: TextStyle): void {
    this.template.update((t) => ({
      ...t,
      transactionalDetailsCustomization: {
        ...t.transactionalDetailsCustomization,
        [fieldId]: value,
      },
    }));
  }

  // ─── Table panel ────────────────────────────────────────────────────
  /** Per-type column configs, in display order. Sourced from the
   *  registry so the form only shows columns relevant to the active
   *  document type — `description` for invoices, `product` for POs,
   *  etc. — instead of a static union with irrelevant rows.
   *  When the active doc type isn't registered, falls back to an
   *  empty list so the form renders nothing rather than crashing. */
  tableColumnConfigs = computed<ReadonlyArray<TableColumnConfig>>(() => {
    return PAPER_LAYOUT[this.template().documentType]?.tableColumns ?? [];
  });

  /** Pull a column safely (returns a fresh default for unknown
   *  columns — defensive against schema drift). */
  tableColumn(id: string): TableColumn {
    return this.template().tableCustomization[id]
        ?? { show: true, width: 0, label: '', translation: {} };
  }

  /** Effective label for a column row in the form — user override
   *  wins, else the registry's `defaultLabel`. The HTML feeds this
   *  to the label input as both the value and the placeholder. */
  columnLabel(cfg: TableColumnConfig): string {
    return this.tableColumn(cfg.id).label || cfg.defaultLabel;
  }

  trackColumnConfig = (_: number, c: TableColumnConfig) => c.id;

  patchTableColumn(id: string, patch: Partial<TableColumn>): void {
    this.template.update((t) => ({
      ...t,
      tableCustomization: {
        ...t.tableCustomization,
        [id]: { ...this.tableColumn(id), ...patch },
      },
    }));
  }

  // ─── Table panel: Columns | Style tab ───────────────────────────────
  tableActiveTab = signal<'columns' | 'style'>('columns');

  /** Active doc type's `DataModelConfig`. Single source of truth for
   *  every per-type field-name / behaviour-flag lookup the form does
   *  — table-chrome ids, CF entity-type slug, hasPayments flag. */
  private dataModel = computed(() => getDataModel(this.template().documentType));

  /** Read the table-header style for the current document type.
   *  Returns a default-shape if the field isn't pre-seeded so the
   *  inputs always have something to bind to. */
  tableHeaderField(): TextStyle {
    const dm = this.dataModel();
    return dm ? this.transactionalField(dm.tableHeaderField) : DEFAULT_TEXT_STYLE({ size: 10 });
  }

  tableLinesField(): TextStyle {
    const dm = this.dataModel();
    return dm ? this.transactionalField(dm.tableLinesField) : DEFAULT_TEXT_STYLE({ size: 10 });
  }

  tableVoidedField(): TextStyle {
    const dm = this.dataModel();
    return dm ? this.transactionalField(dm.tableVoidedField) : DEFAULT_TEXT_STYLE({ size: 10 });
  }

  patchTableHeader(patch: Partial<TextStyle>): void {
    const dm = this.dataModel();
    if (!dm) return;
    this.patchTransactionalField(dm.tableHeaderField, { ...this.tableHeaderField(), ...patch });
  }

  patchTableLines(patch: Partial<TextStyle>): void {
    const dm = this.dataModel();
    if (!dm) return;
    this.patchTransactionalField(dm.tableLinesField, { ...this.tableLinesField(), ...patch });
  }

  patchTableVoided(patch: Partial<TextStyle>): void {
    const dm = this.dataModel();
    if (!dm) return;
    this.patchTransactionalField(dm.tableVoidedField, { ...this.tableVoidedField(), ...patch });
  }

  setTableTab(tab: 'columns' | 'style'): void { this.tableActiveTab.set(tab); }

  // ─── Resizable sidebar panel ─────────────────────────────────────────
  // The right-side config panel (Tabs + accordion) gets cramped on
  // smaller laptops. The user drags a thin splitter on the panel's
  // trailing edge to widen it; we persist the width to localStorage
  // so the next session picks up where they left off.
  private static readonly SIDEBAR_MIN = 260;
  private static readonly SIDEBAR_MAX = 640;
  private static readonly SIDEBAR_KEY = 'dbf:sidebar-w';

  sidebarDragging = signal<boolean>(false);
  /** Current width of the right-side panel in CSS pixels. Driven by
   *  the splitter handler / URL state restore / localStorage restore.
   *  Starts at null so the URL-state effect skips it until the user
   *  actually picks a value. */
  sidebarWidth = signal<number | null>(null);
  private sidebarMoveHandler: ((e: MouseEvent) => void) | null = null;
  private sidebarEndHandler:  (() => void) | null = null;

  /** Restore saved sidebar width before the workspace renders so
   *  the user doesn't see the default flicker. Hooked into the
   *  existing ngOnInit. */
  private restoreSidebarWidth(): void {
    try {
      const stored = localStorage.getItem(DocumentBuilderFormComponent.SIDEBAR_KEY);
      if (!stored) return;
      const w = Math.min(
        DocumentBuilderFormComponent.SIDEBAR_MAX,
        Math.max(DocumentBuilderFormComponent.SIDEBAR_MIN, Number(stored)),
      );
      if (Number.isFinite(w)) this.applySidebarWidth(w);
    } catch { /* localStorage unavailable */ }
  }

  onSidebarSplitterMouseDown(event: MouseEvent): void {
    event.preventDefault();
    this.sidebarDragging.set(true);
    document.body.style.cursor    = 'col-resize';
    document.body.style.userSelect = 'none';

    // Capture direction once so RTL flips the dx sign correctly.
    const isRtl = getComputedStyle(document.documentElement).direction === 'rtl';
    // Sidebar's leading edge stays put; trailing edge follows the
    // cursor. Compute width from the splitter's element rect for
    // robustness against scroll containers.
    const splitter = event.currentTarget as HTMLElement;
    const sidebar  = splitter.parentElement as HTMLElement;
    const startW   = sidebar.getBoundingClientRect().width;
    const startX   = event.clientX;

    this.sidebarMoveHandler = (e: MouseEvent) => {
      const dx = e.clientX - startX;
      const raw = isRtl ? startW - dx : startW + dx;
      const w   = Math.min(
        DocumentBuilderFormComponent.SIDEBAR_MAX,
        Math.max(DocumentBuilderFormComponent.SIDEBAR_MIN, raw),
      );
      this.applySidebarWidth(w);
    };
    this.sidebarEndHandler = () => {
      this.sidebarDragging.set(false);
      document.body.style.cursor    = '';
      document.body.style.userSelect = '';
      if (this.sidebarMoveHandler) window.removeEventListener('mousemove', this.sidebarMoveHandler);
      if (this.sidebarEndHandler)  window.removeEventListener('mouseup',   this.sidebarEndHandler);
      this.sidebarMoveHandler = null;
      this.sidebarEndHandler  = null;
    };

    window.addEventListener('mousemove', this.sidebarMoveHandler);
    window.addEventListener('mouseup',   this.sidebarEndHandler);
  }

  private applySidebarWidth(w: number): void {
    document.documentElement.style.setProperty('--dbf-sidebar-w', `${w}px`);
    this.sidebarWidth.set(Math.round(w));
    try { localStorage.setItem(DocumentBuilderFormComponent.SIDEBAR_KEY, String(w)); }
    catch { /* swallow */ }
  }

  // ─── Total panel ────────────────────────────────────────────────────
  patchTotalTable(patch: Partial<DocumentTemplate['totalSectionCustomization']['totalTable']>): void {
    this.template.update((t) => ({
      ...t,
      totalSectionCustomization: {
        ...t.totalSectionCustomization,
        totalTable: { ...t.totalSectionCustomization.totalTable, ...patch },
      },
    }));
  }
  patchTotalField(field: 'itemTotal' | 'taxTotal' | 'discount' | 'charge' | 'delevary' | 'Total' | 'subTotal' | 'roundingTotal',
                  value: TextStyle): void {
    this.patchTotalTable({ [field]: value });
  }

  patchPaymentTable(patch: Partial<DocumentTemplate['totalSectionCustomization']['paymentTable']>): void {
    this.template.update((t) => ({
      ...t,
      totalSectionCustomization: {
        ...t.totalSectionCustomization,
        paymentTable: { ...t.totalSectionCustomization.paymentTable, ...patch },
      },
    }));
  }
  patchPaymentField(field: 'payments' | 'paymentMethods' | 'credit' | 'balance', value: TextStyle): void {
    this.patchPaymentTable({ [field]: value });
  }

  patchCustomerBalance(patch: Partial<DocumentTemplate['totalSectionCustomization']['customerBalance']>): void {
    this.template.update((t) => ({
      ...t,
      totalSectionCustomization: {
        ...t.totalSectionCustomization,
        customerBalance: { ...t.totalSectionCustomization.customerBalance, ...patch },
      },
    }));
  }

  /** Whether the current document type supports the payments /
   *  balance panels. Either hasPayments OR hasCredits qualifies —
   *  credit notes / supplier credits don't take payments themselves
   *  but DO need the credit-balance row, so the panel is still
   *  relevant. Adding a new doc type needs only the registry entry. */
  showPaymentPanels = computed<boolean>(() => {
    const dm = this.dataModel();
    return !!dm && (dm.hasPayments || dm.hasCredits);
  });

  // ─── Other panel: Fields | Layout sub-tab ───────────────────────────
  // The Other Details panel inherits the Fields/Layout pattern. The
  // Layout sub-tab edits a single shared `additionalDataStyle` that
  // applies to every additional-data row at render time — the model
  // is intentionally simpler than per-row style, since these rows
  // are template-level boilerplate (legal disclaimer, regional
  // note) where mixed styling rarely makes sense.
  otherActiveTab = signal<'fields' | 'layout'>('fields');
  setOtherTab(tab: 'fields' | 'layout'): void { this.otherActiveTab.set(tab); }

  patchAdditionalDataStyle(patch: BulkStylePatch): void {
    this.template.update((t) => ({
      ...t,
      additionalDataStyle: this.applyBulkPatch(t.additionalDataStyle, patch),
    }));
  }

  bulkAdditionalRepresentative = computed<TextStyle>(
    () => this.template().additionalDataStyle,
  );

  // ─── Other panel: additional data CRUD ──────────────────────────────
  addAdditionalField(): void {
    const fields = this.template().additionalData;
    const next: AdditionalDataField = {
      key:      'field' + (fields.length + 1),
      label:    'New field',
      value:    '',
      show:     true,
      position: 'header',
    };
    this.template.update((t) => ({ ...t, additionalData: [...t.additionalData, next] }));
  }
  updateAdditionalField(idx: number, patch: Partial<AdditionalDataField>): void {
    this.template.update((t) => ({
      ...t,
      additionalData: t.additionalData.map((f, i) => i === idx ? { ...f, ...patch } : f),
    }));
  }
  removeAdditionalField(idx: number): void {
    this.template.update((t) => ({
      ...t,
      additionalData: t.additionalData.filter((_, i) => i !== idx),
    }));
  }

  // ─── Elements panel: custom inline elements ─────────────────────────
  /** Type catalogue surfaced as the palette. Adding a type is a
   *  one-step append to the `customElements` array — the legacy form
   *  exposed the same set. */
  readonly customElementTypes = [
    'Text', 'Data Field', 'Image', 'Table',
    'Shape', 'Barcode', 'QR Code', 'Signature', 'Page #',
  ] as const;

  addCustomElement(type: string): void {
    const id   = 'ce-' + Date.now().toString(36);
    const seed: CustomElement = {
      id,
      type,
      position: 'footer',
      content:  type === 'Text' ? 'New text' : '',
    };
    this.template.update((t) => ({ ...t, customElements: [...t.customElements, seed] }));
  }
  updateCustomElement(id: string, patch: Partial<CustomElement>): void {
    this.template.update((t) => ({
      ...t,
      customElements: t.customElements.map((c) => c.id === id ? { ...c, ...patch } : c),
    }));
  }
  removeCustomElement(id: string): void {
    this.template.update((t) => ({
      ...t,
      customElements: t.customElements.filter((c) => c.id !== id),
    }));
  }

  trackField    = (_: number, f: string) => f;
  trackAdditional = (_: number, f: AdditionalDataField) => f.key + '|' + _;
  trackCustom   = (_: number, c: CustomElement) => c.id;

  // ─── Designer mode ──────────────────────────────────────────────────
  /** Currently-selected designer element (`null` means nothing
   *  selected — inspector renders an empty-state card). */
  selectedDesignerId = signal<DesignerElement['id'] | null>(null);

  selectedDesigner = computed<DesignerElement | null>(() => {
    const id = this.selectedDesignerId();
    if (id == null) return null;
    return this.template().designerElements.find((e) => e.id === id) ?? null;
  });

  /** Z-index of the selected element (1-based — friendlier than 0). */
  selectedDesignerZ = computed<number>(() => {
    const id = this.selectedDesignerId();
    if (id == null) return 0;
    return this.template().designerElements.findIndex((e) => e.id === id) + 1;
  });

  /** Palette types — same set the canvas accepts via drag/drop. */
  readonly designerPalette = [
    'Text', 'Data Field', 'Image', 'Table',
    'Shape', 'Barcode', 'QR Code', 'Signature', 'Page #',
  ] as const;

  /** Replace the entire designer-elements array (used by the canvas
   *  on drop / move / resize and the layers list on reorder). */
  setDesignerElements(next: DesignerElement[]): void {
    this.template.update((t) => ({ ...t, designerElements: next }));
  }

  /** Update one element by id and emit. */
  patchDesignerElement(id: DesignerElement['id'], patch: Partial<DesignerElement>): void {
    this.template.update((t) => ({
      ...t,
      designerElements: t.designerElements.map((e) => e.id === id ? { ...e, ...patch } : e),
    }));
  }

  /** Replace the whole element (used when the inspector emits a
   *  full replacement). */
  replaceDesignerElement(el: DesignerElement): void {
    this.patchDesignerElement(el.id, el);
  }

  selectDesignerElement(el: DesignerElement | null): void {
    this.selectedDesignerId.set(el?.id ?? null);
  }

  /** Z-order: send-to-back / send-back / forward / front. */
  arrangeSelected(direction: 'back' | 'backward' | 'forward' | 'front'): void {
    const id = this.selectedDesignerId();
    if (id == null) return;
    this.template.update((t) => {
      const list = [...t.designerElements];
      const idx  = list.findIndex((e) => e.id === id);
      if (idx < 0) return t;
      const [el] = list.splice(idx, 1);
      switch (direction) {
        case 'back':     list.unshift(el);                         break;
        case 'backward': list.splice(Math.max(0, idx - 1), 0, el); break;
        case 'forward':  list.splice(Math.min(list.length, idx + 1), 0, el); break;
        case 'front':    list.push(el);                            break;
      }
      return { ...t, designerElements: list };
    });
  }

  duplicateSelectedDesigner(): void {
    const sel = this.selectedDesigner();
    if (!sel) return;
    const copy: DesignerElement = {
      ...sel,
      id: Date.now(),
      x:  sel.x + 12,
      y:  sel.y + 12,
    };
    this.template.update((t) => ({ ...t, designerElements: [...t.designerElements, copy] }));
    this.selectedDesignerId.set(copy.id);
  }

  deleteSelectedDesigner(): void {
    const id = this.selectedDesignerId();
    if (id == null) return;
    this.template.update((t) => ({
      ...t,
      designerElements: t.designerElements.filter((e) => e.id !== id),
    }));
    this.selectedDesignerId.set(null);
  }

  toggleDesignerHidden(): void {
    const sel = this.selectedDesigner();
    if (!sel) return;
    this.patchDesignerElement(sel.id, { hidden: !sel.hidden });
  }

  toggleDesignerLocked(): void {
    const sel = this.selectedDesigner();
    if (!sel) return;
    this.patchDesignerElement(sel.id, { locked: !sel.locked });
  }

  /** Sync-from-Classic — replaces the current designer-elements with
   *  a fresh seed built from the template's Classic config. Asks for
   *  confirmation when the canvas already has elements so we don't
   *  blow away the user's custom layout. */
  async syncFromClassic(): Promise<void> {
    if (this.template().designerElements.length > 0) {
      const ok = await this.confirm({
        title:   this.translate.instant('DOCUMENT_BUILDER.DESIGNER.SYNC_TITLE'),
        message: this.translate.instant('DOCUMENT_BUILDER.DESIGNER.SYNC_MESSAGE'),
        danger:  true,
      });
      if (!ok) return;
    }
    const seed = seedDesignerFromClassic(this.template());
    this.setDesignerElements(seed);
    this.selectedDesignerId.set(null);
  }

  /** Drag-from-palette: set the MIME data the canvas listens for. */
  onPaletteDragStart(event: DragEvent, type: string): void {
    if (!event.dataTransfer) return;
    event.dataTransfer.setData('application/x-palette-item', type);
    event.dataTransfer.effectAllowed = 'copy';
  }

  trackDesigner = (_: number, e: DesignerElement) => e.id;

  // ─── Preview mode (live data binding) ───────────────────────────────
  /** When true the canvas swaps the editing surface for a read-only
   *  `<app-document-paper>` rendered with the chosen sample profile.
   *  Lets the user verify what'll actually print without leaving the
   *  builder. */
  previewMode = signal<boolean>(false);

  /** Active sample profile (default / paid / discounted / multipage). */
  previewProfileId = signal<SampleProfileId>('default');

  /** Resolved render-data for the preview — recomputed when profile
   *  changes. */
  previewData = computed(() => {
    const builder = SAMPLE_PROFILES[this.previewProfileId()] ?? SAMPLE_PROFILES['default'];
    return builder();
  });

  readonly previewProfileIds = SAMPLE_PROFILE_IDS;

  togglePreview(): void { this.previewMode.update((v) => !v); }
  setPreviewProfile(id: SampleProfileId): void { this.previewProfileId.set(id); }

  trackProfile = (_: number, p: string) => p;
}

