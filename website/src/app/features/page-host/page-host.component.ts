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
import { ActivatedRoute, Router } from '@angular/router';
import { Meta } from '@angular/platform-browser';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { PageService } from '../../core/pages/page.service';
import { ResolvedPage } from '../../core/page-types/page-type.types';
import { PreviewService } from '../../services/preview.service';
import { CustomizerRoot } from '../../customizer-root.component';
import { DynamicComponentComponent } from '../../components/dynamic/dynamic-component.component';
import { ProductListPage } from '../product-list/product-list.page';
import { CategoryListPage } from '../category-list/category-list.page';
import { AccountPage } from '../account/account.page';
import { BookingPage } from '../booking/booking.page';
import { CartPage } from '../cart/cart.page';
import { CheckoutPage } from '../checkout/checkout.page';

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
  imports: [CommonModule, CustomizerRoot, ProductListPage, CategoryListPage, AccountPage, BookingPage, CartPage, CheckoutPage, DynamicComponentComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [`
    .ph-gap { padding: 72px 20px; text-align: center; }
    .ph-gap__title { margin: 0 0 6px; font-size: 18px; font-weight: 600; color: #374151; }
    .ph-gap__hint  { margin: 0; font-size: 14px; color: #9ca3af; }
  `],
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
      @case ('category-list') {
        <app-category-list-page [page]="page()!" />
      }
      @case ('account') {
        <app-account-page [page]="page()!" />
      }
      @case ('booking') {
        <app-booking-page [page]="page()!" />
      }
      @case ('cart') {
        <app-cart-page [page]="page()!" />
      }
      @case ('checkout') {
        <app-checkout-page [page]="page()!" />
      }
      @case ('content') {
        <app-customizer-root />
      }
      @default {
        <!-- A type the registry classifies but this app cannot render yet.
             Every page type now has a renderer, so this is reachable only via a
             type added to the manifest without one here. Saying so beats an
             empty canvas that looks like a page whose content went missing —
             and it keeps any sections the merchant added visible above and
             below. -->
        <div class="ph-gap">
          <p class="ph-gap__title">This page isn't available yet</p>
          <p class="ph-gap__hint">It's being moved over to the new storefront.</p>
        </div>
      }
    }

    @for (section of sectionsAfter(); track section.id) {
      <app-dynamic-component [component]="section" />
    }
  `,
})
export class PageHostComponent implements OnInit {
  private route      = inject(ActivatedRoute);
  private router     = inject(Router);
  private pages      = inject(PageService);
  private preview    = inject(PreviewService);
  private destroyRef = inject(DestroyRef);
  private meta       = inject(Meta);

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

    // Status decides whether this page exists for the visitor at all, so it is
    // applied BEFORE anything renders. This is what replaced the old
    // "Redirect menu to shop" setting: a redirect is a property of the page,
    // works for any page and any target, and — unlike the old toggle — is
    // knowable before the page paints.
    if (!page.missing && page.status === 'redirect' && page.redirectTo) {
      const lang = this.route.snapshot.paramMap.get('lang');
      const target = lang ? ['/', lang, page.redirectTo] : ['/', page.redirectTo];
      void this.router.navigate(target, { replaceUrl: true });
      return;
    }

    // `hidden` means "reachable if you have the link, but not advertised". It
    // has to keep search engines out, or the page is hidden in name only —
    // still indexed, still arriving from search results. Set before render so
    // the tag is in the SSR HTML, which is the copy a crawler reads.
    this.applyRobots(page.missing ? null : page.status);

    this.page.set(page);
    // A missing row falls back to the canvas rather than a 404 — same as today.
    this.renderAs.set(page.missing ? 'content' : page.pageType);
  }

  /**
   * Robots directive for the resolved page.
   *
   * Removed rather than set to `index, follow` for a normal page: absent means
   * "use the site default", and writing an explicit allow here would override a
   * site-wide noindex someone set deliberately.
   */
  private applyRobots(status: string | null): void {
    if (status === 'hidden') {
      this.meta.updateTag({ name: 'robots', content: 'noindex, nofollow' });
    } else {
      this.meta.removeTag("name='robots'");
    }
  }

  /** The customizer drives the canvas over postMessage; PreviewService holds
   *  the live component tree while that's happening. */
  private isCustomizing(): boolean {
    if (typeof window === 'undefined') return false;
    if (window.self !== window.top) return true;                       // iframed editor
    return new URLSearchParams(window.location.search).has('customize');
  }
}
