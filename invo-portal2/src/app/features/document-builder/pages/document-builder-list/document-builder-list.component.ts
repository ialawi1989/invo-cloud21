import {
  ChangeDetectionStrategy,
  Component,
  HostListener,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

import { withTranslations } from '@core/i18n/with-translations';
import { LoadingOverlayComponent } from '@shared/components/spinner/loading-overlay.component';
import { SkeletonComponent } from '@shared/components/skeleton/skeleton.component';
import { TooltipDirective } from '@shared/directives/tooltip.directive';
import { ModalService } from '@shared/modal/modal.service';
import { ConfirmModalComponent, ConfirmModalData } from '@shared/modal/demo/confirm-modal.component';
import {
  DropdownMenuBtnComponent,
  DropdownMenuBtnItem,
} from '@shared/components/dropdown-menu-btn/dropdown-menu-btn.component';

import { DocumentBuilderService } from '../../services/document-builder.service';
import { DocumentTemplateSummary, DocumentType, RenderMode } from '../../services/document-template.types';
import { ModeChooserModalComponent } from './mode-chooser-modal.component';

const VALID_TYPES = new Set<DocumentType>([
  'invoice', 'estimate', 'credit-note',
  'purchase-order', 'bill', 'expense', 'supplier-credit',
]);

/**
 * DocumentBuilderListComponent
 * ────────────────────────────
 * Settings sub-page scoped to a single document type — the URL's
 * `?type=` param is the source of truth. Each entity in Settings
 * (Invoice / Estimate / Bill / …) deep-links here with its own type,
 * so this page never shows a global type-switcher; the user is
 * always in one entity's context.
 *
 * The list shows every saved template for that type. The user can
 * create more, set one as the *default* (the renderer picks the
 * default unless a specific template is named on the entity), and
 * edit / duplicate / delete them.
 */
@Component({
  selector: 'app-document-builder-list',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    FormsModule,
    TranslateModule,
    LoadingOverlayComponent,
    SkeletonComponent,
    TooltipDirective,
    DropdownMenuBtnComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './document-builder-list.component.html',
  styleUrl: './document-builder-list.component.scss',
})
export class DocumentBuilderListComponent implements OnInit {
  private service   = inject(DocumentBuilderService);
  private translate = inject(TranslateService);
  private router    = inject(Router);
  private route     = inject(ActivatedRoute);
  private modal     = inject(ModalService);

  constructor() { withTranslations('document-builder'); }

  loading       = signal<boolean>(false);
  /** Document type for the page — read from the URL's `?type=` once
   *  on init. The user can't change this in the page itself; they
   *  navigate back to Settings to switch entity. */
  documentType  = signal<DocumentType>('invoice');
  templates     = signal<DocumentTemplateSummary[]>([]);

  /** Id of the row whose overflow menu is currently open. `null` means
   *  no menu is open. Tracked here (instead of per-row state) so that
   *  opening one row's menu auto-closes any other. */
  openMenuId    = signal<string | null>(null);

  isEmpty = computed<boolean>(() => !this.loading() && this.templates().length === 0);

  /** Close the overflow menu when the user clicks anywhere outside it.
   *  Per-row menu containers stop propagation, so this only fires for
   *  off-menu clicks. */
  @HostListener('document:click')
  onDocumentClick(): void {
    if (this.openMenuId() !== null) this.openMenuId.set(null);
  }

  toggleMenu(id: string, event: Event): void {
    event.stopPropagation();
    this.openMenuId.set(this.openMenuId() === id ? null : id);
  }

  closeMenu(): void { this.openMenuId.set(null); }

  ngOnInit(): void {
    const raw = (this.route.snapshot.queryParamMap.get('type') ?? '') as DocumentType;
    if (VALID_TYPES.has(raw)) this.documentType.set(raw);
    void this.refresh();
  }

  async refresh(): Promise<void> {
    this.loading.set(true);
    try {
      const list = await this.service.getList(this.documentType());
      this.templates.set(list);
    } finally {
      this.loading.set(false);
    }
  }

  openTemplate(t: DocumentTemplateSummary): void {
    void this.router.navigate(['/settings/document-builder', t.id], {
      queryParams: { type: t.documentType },
    });
  }

  /** Items rendered in each row's `…` overflow menu. "Set as
   *  default" only appears for non-default rows; "Delete" is
   *  disabled on the default row (server forbids removing it). */
  rowMenuItems(t: DocumentTemplateSummary): DropdownMenuBtnItem[] {
    const items: DropdownMenuBtnItem[] = [
      { label: 'COMMON.EDIT',      click: () => this.editTemplate(t,      new Event('synthetic')) },
      { label: 'COMMON.DUPLICATE', click: () => this.duplicateTemplate(t, new Event('synthetic')) },
    ];
    if (!t.isDefault) {
      items.push({
        label: 'DOCUMENT_BUILDER.SET_DEFAULT',
        click: () => this.setDefault(t, new Event('synthetic')),
      });
    }
    items.push({
      label:     'COMMON.DELETE',
      danger:    true,
      separator: true,
      disabled:  !!t.isDefault,
      click:     () => this.deleteTemplate(t, new Event('synthetic')),
    });
    return items;
  }

  /** Edit = same as opening, exposed as a menu item so the row click
   *  is no longer the only path. Also closes the overflow menu. */
  editTemplate(t: DocumentTemplateSummary, event: Event): void {
    event.stopPropagation();
    this.closeMenu();
    this.openTemplate(t);
  }

  /** Client-side duplicate: fetch the full template, strip its id +
   *  default flag, append a "(copy)" suffix to the name, and save as a
   *  new row. The backend doesn't expose a server-side duplicate
   *  endpoint, but `save()` with no id creates a new record, so this
   *  copies every field (header / footer / table / styling / etc.)
   *  faithfully. */
  async duplicateTemplate(t: DocumentTemplateSummary, event: Event): Promise<void> {
    event.stopPropagation();
    this.closeMenu();
    this.loading.set(true);
    try {
      const full = await this.service.getById(t.documentType, t.id);
      if (!full) return;
      const suffix = this.translate.instant('DOCUMENT_BUILDER.DUPLICATE_SUFFIX');
      const copy = {
        ...full,
        id:           '',
        templateName: `${full.templateName} ${suffix}`.trim(),
        isDefault:    false,
      };
      await this.service.save(copy);
      await this.refresh();
    } finally {
      this.loading.set(false);
    }
  }

  async newTemplate(): Promise<void> {
    // Mode is locked once the template is saved (mixing Classic JSON
    // with Designer JSON in a single record makes the view/print
    // pages flip layouts unpredictably). Ask the user up-front, pass
    // the choice to the editor as `?mode=`.
    const ref = this.modal.open<ModeChooserModalComponent, void, RenderMode>(
      ModeChooserModalComponent,
      { size: 'md', closeOnBackdrop: false },
    );
    const mode = await ref.afterClosed();
    if (!mode) return;
    void this.router.navigate(['/settings/document-builder', 'new'], {
      queryParams: { type: this.documentType(), mode },
    });
  }

  async deleteTemplate(t: DocumentTemplateSummary, event: Event): Promise<void> {
    event.stopPropagation();
    if (t.isDefault) {
      // Default templates can't be deleted directly — the user has to
      // set another template as default first. Avoids leaving an
      // entity type without a default to render against.
      const ok = await this.confirm({
        title:   this.translate.instant('DOCUMENT_BUILDER.CANNOT_DELETE_DEFAULT_TITLE'),
        message: this.translate.instant('DOCUMENT_BUILDER.CANNOT_DELETE_DEFAULT_MESSAGE'),
        confirm: this.translate.instant('COMMON.OK'),
      });
      void ok;
      return;
    }
    const ok = await this.confirm({
      title:   this.translate.instant('DOCUMENT_BUILDER.DELETE_TITLE'),
      message: this.translate.instant('DOCUMENT_BUILDER.DELETE_MESSAGE', { name: t.name }),
      danger:  true,
    });
    if (!ok) return;
    await this.service.delete(t.id);
    void this.refresh();
  }

  /** Promote a template to the type's default. The backend
   *  atomically clears the previous default for the same
   *  `(company, type)`. */
  async setDefault(t: DocumentTemplateSummary, event: Event): Promise<void> {
    event.stopPropagation();
    if (t.isDefault) return;
    await this.service.setDefault(t.id, t.documentType);
    void this.refresh();
  }

  trackTemplate = (_: number, t: DocumentTemplateSummary) => t.id;

  private async confirm(data: ConfirmModalData): Promise<boolean> {
    const ref = this.modal.open<ConfirmModalComponent, ConfirmModalData, boolean>(
      ConfirmModalComponent,
      { size: 'sm', data, closeOnBackdrop: false },
    );
    return (await ref.afterClosed()) === true;
  }
}
