import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  ViewChild,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';

import { ToastService } from '@shared/components/toast/toast.service';
import type { CanLeaveComponent } from '@core/guards/unsaved-changes.guard';

import { CustomizerComponent } from '../../page-builder/components/customizer/customizer.component';
import { CustomizerService } from '../../page-builder/services/customizer.service';
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
 * ONLY DYNAMIC PAGES GET HERE. That distinction is the point of the split the
 * old dashboard made and this screen keeps: a dynamic page (`Page` row) is
 * built from sections in this editor; a static page (`StaticPage` row) is a
 * system page — cart, checkout, a product listing — that carries settings only
 * and has no canvas to arrange. The guard below sends static pages back to
 * their settings form rather than opening an editor that could never apply.
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
        [saving]="saving()"
        (save)="save()"
        (back)="back()"/>
    }
  `,
  styles: [`
    :host { display: block; height: 100%; }
    .pe-loading { display: flex; justify-content: center; padding: 80px 0; }
  `],
})
export class WebsitePageEditorComponent implements OnInit, CanLeaveComponent {
  private service    = inject(WebsitePagesService);
  private customizer = inject(CustomizerService);
  private route      = inject(ActivatedRoute);
  private router     = inject(Router);
  private toast      = inject(ToastService);

  @ViewChild(CustomizerComponent) editor?: CustomizerComponent;

  loading = signal<boolean>(true);
  saving  = signal<boolean>(false);
  page    = signal<WebsitePage | null>(null);

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

      // Static pages have settings, not a canvas.
      if (page.rowType !== 'Page') {
        void this.router.navigate(['/page-builder', id]);
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
    return this.customizer.hasUnsavedChanges() && !this.saving();
  }
}
