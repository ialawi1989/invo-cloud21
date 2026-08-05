import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  ViewChild,
  computed,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';

import { ToastService } from '@shared/components/toast/toast.service';
import type { CanLeaveComponent } from '@core/guards/unsaved-changes.guard';

import { CustomizerComponent } from '../../page-builder/components/customizer/customizer.component';
import { CustomizerService } from '../../page-builder/services/customizer.service';
import { PageTypeService } from '../../page-types/page-type.service';
import { WebsitePage, WebsitePagesService } from '../services/website-pages.service';

/**
 * Content-page editor host.
 *
 * The builder was a standalone prototype app (`/dashboard`) that kept pages in
 * localStorage and previewed a hardcoded storefront URL. Here it edits a real
 * page row: `template.sections` is loaded in, and the editor's snapshot is
 * written back through {@link WebsitePagesService}. The preview iframe resolves
 * through StorefrontUrlService, so it points at the right storefront on local /
 * LAN / dev / prod and carries the tenant.
 *
 * EVERY page type opens here, not just content pages. A system page — a
 * listing, checkout — keeps the core it exists for, but can be decorated around
 * it and configured in the same screen: the manifest settings form sits in the
 * left panel, so a merchant changes a setting and watches the preview instead of
 * editing a form and guessing.
 *
 * What keeps that safe is the manifest: `allowedWidgets` says which blocks a
 * type accepts (a content page takes everything; a listing takes decoration),
 * and `coreBlockTitle` puts the page's own output in the section list as a
 * locked row, so it is visible but not removable.
 */
@Component({
  selector: 'app-website-page-editor',
  standalone: true,
  imports: [CommonModule, CustomizerComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (loading()) {
      <div class="pe-loading"><span class="spinner spinner--lg"></span></div>
    } @else {
      <app-customizer
        [pageSlug]="page()?.slug ?? ''"
        [pageType]="page()?.pageType ?? ''"
        [pageSettings]="page()?.settings ?? {}"
        [pageSource]="page()?.source ?? null"
        [allowedWidgets]="allowedWidgets()"
        [coreBlockTitle]="coreBlockTitle()"
        [saving]="saving()"
        (settingsChange)="onSettingsChange($event)"
        (save)="save()"
        (back)="back()"/>
    }
  `,
  styles: [`
    /* Registered outside MainLayoutComponent, so there is no shell to fit
       inside — the builder owns the viewport. */
    :host { display: block; height: 100dvh; overflow: hidden; }
    .pe-loading { display: flex; align-items: center; justify-content: center; height: 100%; }
  `],
})
export class WebsitePageEditorComponent implements OnInit, CanLeaveComponent {
  private service    = inject(WebsitePagesService);
  private customizer = inject(CustomizerService);
  private registry   = inject(PageTypeService);
  private route      = inject(ActivatedRoute);
  private router     = inject(Router);
  private toast      = inject(ToastService);

  @ViewChild(CustomizerComponent) editor?: CustomizerComponent;

  loading = signal<boolean>(true);
  saving  = signal<boolean>(false);
  page    = signal<WebsitePage | null>(null);
  /** Settings edited in the panel, pending save. */
  private settingsDirty = signal<boolean>(false);

  /** Widget rules for this page's type — null while the page loads. */
  allowedWidgets = computed<string[] | null>(() => {
    const type = this.page()?.pageType;
    return type ? (this.registry.typeDef(type)?.allowedWidgets ?? null) : null;
  });

  coreBlockTitle = computed<string>(() => {
    const type = this.page()?.pageType;
    return type ? (this.registry.typeDef(type)?.coreBlockTitle ?? '') : '';
  });

  /** Settings are edited in the builder panel; keep them on the page so Save
   *  writes layout AND configuration in one round-trip. */
  onSettingsChange(settings: Record<string, any>): void {
    const page = this.page();
    if (!page) return;
    this.page.set({ ...page, settings });
    this.settingsDirty.set(true);
  }

  async ngOnInit(): Promise<void> {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id || id === 'new') {
      // A page must exist before it can be laid out — it needs a row to save into.
      void this.router.navigate(['/page-builder']);
      return;
    }

    try {
      const page = await this.service.getOne(id);
      if (!page) {
        this.toast.error('COMMON.LOAD_FAILED');
        void this.router.navigate(['/page-builder']);
        return;
      }

      this.page.set(page);
      this.customizer.loadPageData(page.sections);
    } finally {
      this.loading.set(false);
    }
  }

  async save(): Promise<void> {
    const page = this.page();
    if (!page || this.saving()) return;

    this.saving.set(true);
    try {
      // The editor snapshot IS the page's sections — one field on the row, so
      // the rest of the page (name, slug, settings) round-trips untouched.
      const snapshot = this.customizer.snapshot();
      const res = await this.service.save({ ...page, sections: snapshot as any });

      if (res.success) {
        this.settingsDirty.set(false);
        this.customizer.markSaved();
        this.editor?.savedOk();
        this.toast.success('WEBSITE.PAGES.SAVED');
      } else {
        this.editor?.saveFailed();
        this.toast.error('COMMON.SAVE_FAILED', res.msg);
      }
    } catch (e: any) {
      this.editor?.saveFailed();
      this.toast.error('COMMON.SAVE_FAILED', e?.message);
    } finally {
      this.saving.set(false);
    }
  }

  back(): void {
    void this.router.navigate(['/page-builder']);
  }

  hasUnsavedChanges(): boolean {
    return (this.customizer.hasUnsavedChanges() || this.settingsDirty()) && !this.saving();
  }
}
