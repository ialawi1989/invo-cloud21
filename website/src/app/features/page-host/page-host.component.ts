import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { PageService } from '../../core/pages/page.service';
import { ResolvedPage } from '../../core/page-types/page-type.types';
import { PreviewService } from '../../services/preview.service';
import { CustomizerRoot } from '../../customizer-root.component';
import { DynamicComponentComponent } from '../../components/dynamic/dynamic-component.component';
import { ProductListPage } from '../product-list/product-list.page';

/**
 * Renders whatever page lives at this URL, by TYPE.
 *
 * This is the hinge of the refactor. Before, every page type was a hardcoded
 * route → component pair, so `/menu` and `/shop` needed two of everything and a
 * new page type meant editing three repos. Now the slug is just a lookup key:
 * the row says what it is (`pageType`) and this host picks the renderer.
 *
 * Adding a page type from here on = one entry in the manifest + one component
 * in the switch below. No routing changes, no dashboard changes.
 *
 * The customizer canvas keeps priority: while the dashboard is driving this
 * page through postMessage there is no saved row to fetch, so we render the
 * canvas immediately and never block on the network.
 */
@Component({
  selector: 'app-page-host',
  standalone: true,
  imports: [CommonModule, CustomizerRoot, ProductListPage, DynamicComponentComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <!-- Sections saved in the builder render AROUND the page's own output, so a
         system page (a listing, checkout) can carry a banner or some copy while
         keeping the core it exists for. A section's slot decides the side;
         anything without one sits on top, where decoration usually goes. -->
    @for (section of sectionsBefore(); track section.id) {
      <app-dynamic-component [component]="section" />
    }

    @switch (renderAs()) {
      @case ('product-list') {
        <app-product-list-page [page]="page()!" />
      }
      @default {
        <!-- content pages (and anything not yet ported) keep the editor canvas -->
        <app-customizer-root />
      }
    }

    @for (section of sectionsAfter(); track section.id) {
      <app-dynamic-component [component]="section" />
    }
  `,
})
export class PageHostComponent implements OnInit {
  private route      = inject(ActivatedRoute);
  private pages      = inject(PageService);
  private preview    = inject(PreviewService);
  private destroyRef = inject(DestroyRef);

  page = signal<ResolvedPage | null>(null);

  /** What to mount. Defaults to the canvas so the customizer is never delayed
   *  by a page fetch, then narrows once the row resolves. */
  renderAs = signal<string>('content');

  /**
   * Builder sections for a NON-content page. A content page's sections are the
   * whole page and the canvas already renders them, so they'd double up here.
   */
  private decorations = computed<any[]>(() => {
    const page = this.page();
    if (!page || page.pageType === 'content') return [];
    return [...(page.sections ?? [])].sort((a, b) => (a?.order ?? 0) - (b?.order ?? 0));
  });

  sectionsBefore = computed<any[]>(() =>
    this.decorations().filter(s => (s?.slot ?? 'top') !== 'bottom'));

  sectionsAfter = computed<any[]>(() =>
    this.decorations().filter(s => s?.slot === 'bottom'));

  ngOnInit(): void {
    this.route.paramMap
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(params => {
        const slug = params.get('page') ?? 'home';
        void this.resolve(slug);
      });
  }

  private async resolve(slug: string): Promise<void> {
    // Editor session: the dashboard owns what's on screen.
    if (this.isCustomizing()) {
      this.renderAs.set('content');
      return;
    }

    const page = await this.pages.getPage(slug);
    this.page.set(page);
    // A missing row falls back to the canvas rather than a 404 — same as today.
    this.renderAs.set(page.missing ? 'content' : page.pageType);
  }

  /** The customizer drives the canvas over postMessage; PreviewService holds
   *  the live component tree while that's happening. */
  private isCustomizing(): boolean {
    if (typeof window === 'undefined') return false;
    if (window.self !== window.top) return true;                       // iframed editor
    return new URLSearchParams(window.location.search).has('customize');
  }
}
