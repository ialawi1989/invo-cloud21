import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  EventEmitter,
  HostListener,
  Input,
  OnInit,
  Output,
  ViewChild,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { TooltipDirective } from '@shared/directives/tooltip.directive';
import { FormsModule } from '@angular/forms';
import { CdkDropListGroup } from '@angular/cdk/drag-drop';
import { TranslateModule } from '@ngx-translate/core';
import { DesignerToolboxComponent } from './toolbox/toolbox.component';
import { CanvasComponent } from './canvas/canvas.component';
import { PropertyPanelComponent } from './property-panel/property-panel.component';
import { DesignerStateService } from '../services/designer-state.service';
import { HistoryService } from '../services/history.service';
import { HtmlRenderer } from '../renderers/html/html-renderer';
import { PaginationEngine } from '../core/layout/pagination';
import { registerDefaultBlocks } from '../core/registry/default-blocks';
import { MASTER_PAGE_ID, ReportTemplate } from '../core/types/template.types';
import { FilterMap } from '../core/types/binding.types';
import { ModalService } from '@shared/modal/modal.service';
import { ConfirmModalComponent, ConfirmModalData } from '@shared/modal/demo/confirm-modal.component';
import { ToastService } from '@shared/components/toast/toast.service';

/** True for elements where the browser's own undo stack is the right one. */
function isTextEntry(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el) return false;
  const tag = el.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable;
}

/**
 * Free-position document designer — the shell that hosts the toolbox,
 * canvas, and property panel.
 *
 * Mount it as `<app-free-designer>` and drive it through Inputs:
 *
 *   [template]     — the ReportTemplate to edit. Required; the host owns
 *                    persistence, so there is no localStorage fallback.
 *   [data]         — sample data bound to the preview. Wins over the
 *                    template's own `sampleData`, letting the host preview
 *                    against a real record without rebuilding the template.
 *   [locale]       — patches `template.locale`, used by Intl-based filters.
 *   [extraFilters] — merged over the built-in binding filters. The host's
 *                    tenant-aware `currency` goes here.
 *   [defaultTemplate]
 *                  — the type's starter layout, restored by the toolbar's
 *                    Reset button. Omitted → the button hides.
 *
 * Outputs mirror the toolbar actions; `templateChange` fires after every
 * edit so the host can track dirty state.
 *
 * Note that DesignerStateService and HistoryService are root-provided
 * singletons — ngOnInit resets both so switching document types doesn't
 * inherit the previous template's undo stack.
 */
@Component({
  selector: 'app-free-designer',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TooltipDirective, 
    CommonModule,
    FormsModule,
    CdkDropListGroup,
    TranslateModule,
    DesignerToolboxComponent,
    CanvasComponent,
    PropertyPanelComponent,
  ],
  templateUrl: './free-designer.component.html',
  styleUrls: ['./free-designer.component.scss'],
})
export class FreeDesignerComponent implements OnInit {
  readonly state = inject(DesignerStateService);
  readonly history = inject(HistoryService);
  /** The app's themed confirm dialog, so destructive designer actions look
   *  like every other confirmation in the product rather than a browser popup. */
  private readonly modal = inject(ModalService);
  private readonly toast = inject(ToastService);
  private readonly helpers = {
    confirmAsync: async (o: { title: string; text: string; confirmButtonText: string }): Promise<boolean> => {
      const data: ConfirmModalData = { title: o.title, message: o.text, confirm: o.confirmButtonText, danger: true };
      const ref = this.modal.open<ConfirmModalComponent, ConfirmModalData, boolean>(ConfirmModalComponent, { size: 'sm', data, closeOnBackdrop: false });
      return (await ref.afterClosed()) === true;
    },
    errorMsg: (o: { title: string; text: string }): void => { this.toast.error(o.title, o.text); },
  };

  // ─── Inputs ─────────────────────────────────────────────────────

  /** The last snapshot this component pushed out through `templateChange`.
   *  Hosts store it and bind it straight back, so it returns here as an Input
   *  write on the next tick — see the setter below. */
  private lastEmitted: ReportTemplate | null = null;

  @Input() set template(value: ReportTemplate | null | undefined) {
    if (!value) return;
    // Our own edit echoing back off the host's `[template]` binding. Ingesting
    // it would run setTemplate(), which clears the selection and the undo
    // stack — so every keystroke in the property panel would deselect the
    // block being edited and jump the panel back to Page settings.
    if (value === this.lastEmitted) return;
    this.state.setTemplate(value);
    // A genuinely new template starts a fresh undo timeline — otherwise Undo
    // would walk back into the previously loaded document.
    this.history.clear();
  }

  @Input() set data(value: Record<string, unknown> | undefined) {
    this.state.setSampleData(value);
  }

  @Input() set extraFilters(value: FilterMap | undefined) {
    this.state.setExtraFilters(value);
  }

  @Input() set locale(value: string | undefined) {
    const t = this.state.template();
    if (t && value && t.locale !== value) {
      this.state.setTemplate({ ...t, locale: value });
    }
  }

  /** The pristine layout for this document type, used by the toolbar's Reset
   *  button. Only the host knows which document type is being designed, so it
   *  builds the starter template and hands it down. Omitted → Reset hides. */
  @Input() defaultTemplate: ReportTemplate | null = null;

  /** Disables the Save button while the host is persisting. */
  @Input() saving = false;

  /** Hides this component's own toolbar header, for a host that renders its
   *  own consolidated header and drives this component's actions through
   *  the public methods below instead (see DocumentBuilderComponent). */
  @Input() showToolbar = true;

  @ViewChild('jsonInput') private _jsonInputRef!: ElementRef<HTMLInputElement>;

  /** Opens the file picker for JSON import — what the toolbar's own button
   *  does; exposed so a host hiding the toolbar can trigger it too. */
  triggerImportJson(): void {
    this._jsonInputRef.nativeElement.click();
  }

  // ─── Outputs ────────────────────────────────────────────────────

  /** Fires after every edit with the current template snapshot. */
  @Output() templateChange = new EventEmitter<ReportTemplate>();
  @Output() save = new EventEmitter<ReportTemplate>();
  /** Emits the rendered HTML. Falls back to opening a print tab when
   *  nothing is subscribed. */
  @Output() previewHtml = new EventEmitter<string>();
  /** Emits the pdfmake doc definition. Falls back to downloading the PDF. */
  @Output() exportPdf = new EventEmitter<unknown>();

  // ─── View state ─────────────────────────────────────────────────

  readonly zoomPct = computed(() => Math.round(this.state.zoom() * 100));
  readonly templateName = computed(() => this.state.template()?.name ?? 'Untitled');

  // ─── Pages ──────────────────────────────────────────────────────

  readonly MASTER_PAGE_ID = MASTER_PAGE_ID;
  readonly activePageId = this.state.activePageId;

  /** Master page first, then every extra page in the order they were added. */
  readonly pages = computed(() => [
    { id: MASTER_PAGE_ID, name: 'Master' },
    ...this.state.extraPages(),
  ]);

  /** Id of the page whose tab is currently showing its inline rename input;
   *  `null` when no tab is being renamed. */
  readonly renamingPageId = signal<string | null>(null);
  renameDraft = '';

  selectPage(pageId: string): void {
    if (this.renamingPageId()) return; // don't steal focus from the rename input
    this.state.setActivePage(pageId);
  }

  addPage(): void {
    this.state.addPage();
  }

  startRenamePage(pageId: string, currentName: string, ev: Event): void {
    ev.stopPropagation();
    this.renameDraft = currentName;
    this.renamingPageId.set(pageId);
  }

  commitRenamePage(pageId: string): void {
    if (this.renamingPageId() !== pageId) return;
    this.state.renamePage(pageId, this.renameDraft);
    this.renamingPageId.set(null);
  }

  cancelRenamePage(): void {
    this.renamingPageId.set(null);
  }

  async removePage(pageId: string, name: string, ev: Event): Promise<void> {
    ev.stopPropagation();
    const ok = await this.helpers.confirmAsync({
      title: `Delete "${name}"?`,
      text: 'This page and everything on it will be removed. You can undo this, and nothing is saved until you press Save.',
      confirmButtonText: 'Delete',
    });
    if (!ok) return;
    this.state.removePage(pageId);
  }

  constructor() {
    // Forward edits to the host. The first tick is the ingest of our own
    // `template` Input — echoing that would mark the host dirty before the
    // user has touched anything.
    let firstTick = true;
    effect(() => {
      const t = this.state.template();
      if (firstTick) {
        firstTick = false;
        return;
      }
      if (!t) return;
      this.lastEmitted = t;
      this.templateChange.emit(t);
    });
  }

  ngOnInit(): void {
    registerDefaultBlocks();
  }

  /**
   * Ctrl/Cmd+Z and Ctrl+Y — the shortcuts the toolbar buttons advertise.
   *
   * Bound at window level rather than on the canvas: undo is a designer-wide
   * action, and the canvas handler both required focus on the canvas and
   * returned early whenever nothing was selected, so the shortcut never fired
   * in the cases users reach for it most.
   */
  @HostListener('window:keydown', ['$event'])
  onKeydown(ev: KeyboardEvent): void {
    if (!(ev.ctrlKey || ev.metaKey) || ev.altKey) return;
    // Inside a text field the browser's own undo is what the user means.
    if (isTextEntry(ev.target)) return;

    const key = ev.key.toLowerCase();
    if (key === 'z' && !ev.shiftKey) {
      this.history.undo();
    } else if (key === 'y' || (key === 'z' && ev.shiftKey)) {
      this.history.redo();
    } else {
      return;
    }
    ev.preventDefault();
  }

  // ─── Toolbar ────────────────────────────────────────────────────

  zoomIn(): void {
    this.state.setZoom(this.state.zoom() + 0.1);
  }

  zoomOut(): void {
    this.state.setZoom(this.state.zoom() - 0.1);
  }

  resetZoom(): void {
    this.state.setZoom(1);
  }

  onSave(): void {
    const t = this.state.template();
    if (t) this.save.emit(t);
  }

  /**
   * Throw away the current layout and start again from this document type's
   * starter design.
   *
   * Applied through the state service rather than by asking the host to
   * re-bind `[template]` — that setter clears the undo stack, and a reset is
   * exactly the edit a user is most likely to want to take back. Going
   * through `setTemplate` records it as one ordinary undo step, so Ctrl+Z
   * brings the old design straight back.
   *
   * Nothing is persisted: the reset flows out through `templateChange` as an
   * unsaved edit like any other, and Save still has to be pressed.
   */
  async onResetToDefault(): Promise<void> {
    const def = this.defaultTemplate;
    if (!def) return;
    const ok = await this.helpers.confirmAsync({
      title: 'Reset to the default layout?',
      text:
        'Your current design will be replaced. You can undo this, and nothing ' +
        'is saved until you press Save.',
      confirmButtonText: 'Reset',
    });
    if (!ok) return;

    const current = this.state.template();
    this.state.setTemplate({
      ...def,
      // Keep the identity of the design being replaced so Save updates the
      // same record rather than orphaning it behind a new id.
      id: current?.id ?? def.id,
      name: current?.name ?? def.name,
      // The host's `[data]` lives ON the template (setSampleData writes it
      // there), and Angular only re-runs that setter when the host's object
      // identity changes — which a reset doesn't cause. Carrying it over is
      // what keeps the restored layout previewing against real data instead
      // of rendering every binding blank.
      sampleData: current?.sampleData ?? def.sampleData,
      updatedAt: new Date().toISOString(),
    });
  }

  /** Render the template to self-contained HTML and hand it to the host.
   *  With no subscriber, opens it in a new tab so Ctrl+P gives exactly the
   *  printed output. */
  onPreview(): void {
    const t = this.state.template();
    if (!t) return;
    // Built on the SHARED binding engine so the host's extraFilters (e.g.
    // their currency formatter) apply here exactly as on the canvas.
    const engine = this.state.bindingEngine();
    const html = new HtmlRenderer(engine, new PaginationEngine(engine)).render({
      template: t,
      data: t.sampleData ?? {},
      locale: t.locale,
    });
    this.previewHtml.emit(html);
    if (!this.previewHtml.observed) {
      const w = window.open('', '_blank');
      if (w) {
        w.document.open();
        w.document.write(html);
        w.document.close();
      }
    }
  }

  /**
   * PDF export. pdfmake and its ~1MB font VFS are dynamic-imported so they
   * only download when the user actually exports.
   */
  async onExportPdf(): Promise<void> {
    const t = this.state.template();
    if (!t) return;
    try {
      const [{ PdfMakeRenderer }, { registerArabicFont }, pdfMakeMod, vfsMod] = await Promise.all([
        import('../renderers/pdfmake/pdfmake-renderer'),
        import('../renderers/pdfmake/pdfmake-fonts'),
        import('pdfmake/build/pdfmake'),
        import('pdfmake/build/vfs_fonts'),
      ]);

      const pdfMake = (pdfMakeMod as unknown as { default?: typeof pdfMakeMod }).default ?? pdfMakeMod;
      // vfs_fonts has shipped three different export shapes across pdfmake
      // 0.2.x; probe all of them rather than pinning to one.
      const vfs =
        (vfsMod as unknown as { default?: Record<string, string> }).default ??
        (vfsMod as unknown as { pdfMake?: { vfs: Record<string, string> } }).pdfMake?.vfs ??
        (vfsMod as unknown as Record<string, string>);

      const pdfMakeRef = pdfMake as unknown as { vfs: Record<string, string> };
      pdfMakeRef.vfs = vfs;
      // Layer Amiri on top of Roboto so Arabic blocks can opt into it.
      await registerArabicFont(pdfMakeRef);

      // renderAsync pre-fetches remote http(s) images into pdfmake's image
      // dictionary — pdfmake itself only accepts data URIs or registered
      // keys, so a bare URL would throw "not found in virtual file system".
      const docDef = await new PdfMakeRenderer(this.state.bindingEngine()).renderAsync({
        template: t,
        data: t.sampleData ?? {},
        locale: t.locale,
      });

      this.exportPdf.emit(docDef);
      if (!this.exportPdf.observed) {
        (pdfMake as unknown as { createPdf: (def: unknown) => { download: (n: string) => void } })
          .createPdf(docDef)
          .download(`${t.name || 'document'}.pdf`);
      }
    } catch (err) {
      console.error('PDF export failed', err);
    }
  }

  /** Download the template as JSON, sampleData included so it round-trips
   *  into another designer instance with the same preview bindings. */
  exportJson(): void {
    const t = this.state.template();
    if (!t) return;
    const blob = new Blob([JSON.stringify(t, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const safeName = (t.name || 'template').replace(/[^a-z0-9_\- ]+/gi, '_').trim() || 'template';
    a.href = url;
    a.download = `${safeName}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  /** Load a template from a `.json` file. Validation is deliberately thin —
   *  we only check it looks like a ReportTemplate; a shape failure alerts
   *  rather than silently no-op'ing. */
  onImportJsonFile(ev: Event): void {
    const input = ev.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result ?? ''));
        if (!parsed || typeof parsed !== 'object' || !Array.isArray((parsed as ReportTemplate).sections)) {
          throw new Error('JSON does not look like a report template (missing sections[])');
        }
        this.state.setTemplate(parsed as ReportTemplate);
        this.history.clear();
      } catch (err) {
        this.importFailed(err instanceof Error ? err.message : String(err));
      } finally {
        // Reset so re-picking the same file fires `change` again.
        input.value = '';
      }
    };
    reader.onerror = () => {
      this.importFailed(reader.error?.message ?? 'unable to read file');
      input.value = '';
    };
    reader.readAsText(file);
  }

  private importFailed(reason: string): void {
    this.helpers.errorMsg({ title: 'MESSAGE.OPS', text: `Import failed: ${reason}` });
  }
}
