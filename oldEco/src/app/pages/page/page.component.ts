import {
  Component,
  ElementRef,
  Inject,
  OnDestroy,
  PLATFORM_ID,
  QueryList,
  ViewChildren,
} from '@angular/core';

import { Subject, Subscription, takeUntil } from 'rxjs';
import { PageData } from '../../models/page-data/pageData';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { BannerSectionComponent } from '../../components/sections/banner-section/banner-section.component';
import { CategoryCollectionSectionComponent } from '../../components/sections/category-collection-section/category-collection-section.component';
import { ProductCollectionSectionComponent } from '../../components/sections/product-collection-section/product-collection-section.component';
import { RichTextSectionComponent } from '../../components/sections/rich-text-section/rich-text-section.component';
import { CartService } from '../../services/cartServices/cart.service';
import { LastOrderPlacedSectionComponent } from '../../components/sections/last-order-placed-section/last-order-placed-section.component';
import { ActivatedRoute, NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs';
import { PageStateService } from '../../services/page-state.service';
import {
  trigger,
  state,
  style,
  transition,
  animate,
} from '@angular/animations';
import { TranslateModule } from '@ngx-translate/core';
import { PageBuilderService } from '../../services/pageBuilderServices/page-builder.service';

import { Location } from '@angular/common';
import { FormsSectionComponent } from '../../components/sections/forms-section/forms-section.component';
import { SpinnerComponent } from '../../components/spinner/spinner.component';
import { ButtonsSectionComponent } from '../../components/sections/buttons-section/buttons-section.component';
import { AppServices } from 'src/app/services/appServices';
import { Company } from 'src/app/models/company.model';
import { CompanyServices } from 'src/app/services/companyServices/company.service';
import { TextSectionComponent } from "../../components/sections/text-section/text-section.component";
import { LastReservationPlacedSectionComponent } from "../../components/sections/last-reservation-placed-section/last-reservation-placed-section.component";
import { ContinueShoppingSectionComponent } from "src/app/components/sections/continue-shopping/continue-shopping.component";
import { NoConnectionComponent } from "../no-connection/no-connection.component";
import { ErrorComponent } from "../error/error.component";

@Component({
  selector: 'app-page',
  imports: [
    CommonModule,
    CategoryCollectionSectionComponent,
    ProductCollectionSectionComponent,
    BannerSectionComponent,
    RichTextSectionComponent,
    LastOrderPlacedSectionComponent,
    TranslateModule,
    // RouterLink,
    FormsSectionComponent,
    SpinnerComponent,
    ButtonsSectionComponent,
    TextSectionComponent,
    LastReservationPlacedSectionComponent,
    ContinueShoppingSectionComponent,
    NoConnectionComponent,
    ErrorComponent
  ],
  animations: [
    trigger('autoHeight', [
      state('void', style({ height: '0', opacity: 0 })),
      state('*', style({ height: '*', opacity: 1 })),
      transition('void <=> *', animate('300ms ease-in-out')),
    ]),
  ],
  templateUrl: './page.component.html',
  styleUrl: './page.component.css',
})
export class PageComponent implements OnDestroy {
  private destroy$ = new Subject<void>();
  pageId: string = '';
  isFirstVisit: boolean = false;
  isBrowser: boolean;
  slug: any = null;
  isPageFound = true;
  // FIX: distinguish between "page slug doesn't exist (404)" and
  // "real network/API error". Previously both cases showed <app-no-connection>,
  // which was wrong for users hitting an unknown URL.
  isConnectionError = false;
  pageSection: PageData | any = new PageData();
  loading = true;

  companyData: Company = new Company();
  subscription: any = null;

  constructor(
    @Inject(PLATFORM_ID) private platformId: any,
    private pageStateService: PageStateService,
    private router: Router,
    private companyService: CompanyServices,
    private location: Location,
    private pageBuilderServices: PageBuilderService,
    private cartService: CartService,
    private appService: AppServices,
    private route: ActivatedRoute
  ) {
    this.isBrowser = isPlatformBrowser(this.platformId);
  }


  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.sectionObserver?.disconnect();
    this.pageStateService.removePageState(this.pageId);
    // Unsubscribe to prevent memory leaks
    if (this.subscription) {
      this.subscription.unsubscribe();
    }
  }

  async ngOnInit() {
    if (this.isBrowser) {
      this.getSlug();
      await this.getPageData();
      this.loading = false;
      // Defer observer setup to next tick so DOM has rendered sections
      setTimeout(() => this.scrollPageToloadData(), 0);
      this.router.events
        .pipe(takeUntil(this.destroy$), filter((event): event is NavigationEnd => event instanceof NavigationEnd))
        .subscribe(() => {
          this.checkScrollAndLoad();
        });
      localStorage.removeItem('orderPlaced'); // Reset flag after loading home page
    }

    this.companyService.companyData$.pipe(takeUntil(this.destroy$)).subscribe({
      next: (data: Company) => {
        this.companyData = data;
      },
    });

    this.subscription = this.router.events
      .pipe(takeUntil(this.destroy$), filter((event): event is NavigationEnd => event instanceof NavigationEnd))
      .subscribe((event: NavigationEnd) => {
        setTimeout(() => {
          this.getSlug();
          this.getPageData();
          this.scrollPageToloadData();
        }, 75);
      });
  }

  ngAfterViewInit() { }

  sectionsLoaded = false;
  ngAfterViewChecked() {
    if (this.lazyLoadableElements?.length > 0 && !this.sectionsLoaded) {
      this.sectionsLoaded = true; // Prevent multiple executions
      this.checkScrollAndLoad();
    }
  }

  async getPageData() {
    // FIX: catch upstream errors (timeouts, 4xx, "Company Not Found") here so
    // the caller can always reach `loading = false`. Without this, a thrown
    // error from the API leaves the spinner stuck on screen forever.
    //
    // We now distinguish two failure modes:
    //   - thrown error  => real network/API problem  => show <app-no-connection>
    //   - returns null  => slug exists in URL but no CMS page => show 404
    let data: any;
    let threwError = false;
    try {
      data = await this.getPage(this.slug ? this.slug : 'home');
    } catch (error) {
      data = null;
      threwError = true;
    }
    window.scrollTo({ top: 5.725 });
    if (data) {
      this.isPageFound = true;
      this.isConnectionError = false;
      this.pageSection = { ...data };
    } else {
      this.isPageFound = false;
      this.isConnectionError = threwError;
    }

  }

  parseOptions(options: any) {
    return 'string' == typeof options
      ? JSON.parse(options.replace(/'/g, '"').replace(';', ''))
      : {};
  }

  defaults = {
    animation: {
      name: 'fadeIn',
      duration: '1.2s',
      delay: '.2s',
    },
  };

  iterateChildApear(section: any) {
    // Get all child elements of the section
    const childElements = section.querySelectorAll('*');
    const that = this;
    childElements.forEach((child: any, index: number) => {
      const options = child.getAttribute('data-animation-options');
      var settings =
        options != '' ? this.parseOptions(options) : this.defaults.animation;

      if (child.classList.contains('appear-animate')) {
        setTimeout(
          function () {
            child.style.animationDuration =
              settings.duration ?? that.defaults.animation.duration;
            // child.style.animationDelay = settings.delay ?? that.defaults.animation.delay;
            child.classList.add(settings.name ?? that.defaults.animation.name);
            child.classList.add('appear-animation-visible');

            if (that.pageSection.template.sections[index]) {
              that.pageSection.template.sections[index].show = true;
            }
          },
          settings.delay ? Number(settings.delay.slice(0, -1)) * 1000 : 0
        );
      }
    });
  }

  @ViewChildren('lazyLoadable', { read: ElementRef })
  lazyLoadableElements!: QueryList<ElementRef>;

  private sectionObserver: IntersectionObserver | null = null;

  /** Set up IntersectionObserver instead of scroll listener to avoid forced reflows */
  private initSectionObserver() {
    if (!this.isBrowser || !this.lazyLoadableElements) return;

    this.sectionObserver?.disconnect();

    this.sectionObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;

        const section = entry.target as HTMLElement;
        const index = this.getSectionIndex(section);
        if (index === -1) return;

        if (this.pageSection.template.sections[index] && !this.pageSection.template.sections[index].show) {
          try {
            const animationOptions = this.pageSection.template.sections[index].animationOptions;
            if (!animationOptions) return;
            section.style.animationDuration = animationOptions.duration;
            section.style.animationDelay = animationOptions.delay;
            section.classList.add(animationOptions.name);
            section.classList.add('appear-animation-visible');
          } catch (error) {
          } finally {
            this.iterateChildApear(section);
            this.pageSection.template.sections[index].show = !this.pageSection.template.sections[index].show;
          }
        }

        // Stop observing once animated
        this.sectionObserver?.unobserve(section);
      });
    }, { rootMargin: '0px 0px 20% 0px' });

    this.lazyLoadableElements.forEach((el) => {
      this.sectionObserver!.observe(el.nativeElement);
    });
  }

  private getSectionIndex(target: HTMLElement): number {
    if (!this.lazyLoadableElements) return -1;
    const arr = this.lazyLoadableElements.toArray();
    for (let i = 0; i < arr.length; i++) {
      if (arr[i].nativeElement === target) return i;
    }
    return -1;
  }

  checkScrollAndLoad() {
    this.initSectionObserver();
  }

  getSlug() {
    const url = this.location.path(); // Get the current path
    const segments = url.split('/'); // Split the path into segments
    // Check if there are enough segments and get the desired one
    if (segments.length > 1) {
      let slug = segments[segments.length - 1]; // Get the second segment (index 1)
      this.slug = slug;
    } else {
      this.slug = null;
    }
  }


  async getPage(slug: string) {
    let data = await this.pageBuilderServices.getPage(slug);

    if (data) {
      return data;
    } else {
      return false;
    }
  }

  getDefaultPageSlug() {
    return new Promise((response) => {
      response('home');
    });
  }

  gotoHomePage() {
    this.router.navigate(['/'], { queryParams: {} });
    setTimeout(() => {
      this.getPageData();
    }, 1000);
  }

  isHeaderOverlay(): boolean {
    const url = this.router.url.split('?')[0];
    const isHomePage = url === '/' || url === '/home' || url === '';
    const enabledOverlay = this.companyData.themeSettings.template?.header?.enabledOverlay;
    if (!isHomePage || !enabledOverlay) return false;
    const pageData = this.pageBuilderServices.pageData();
    const firstSection = pageData?.template?.sections?.[0];
    return firstSection?.sectionType === 'Banner section';
  }

  scrollPageToloadData() {
    // IntersectionObserver fires automatically — no scroll hack needed
    document.body.style.height = '5000px';
    window.scrollTo({ top: 10, behavior: 'instant' });
    setTimeout(() => {
      window.scrollTo({ top: 0 });
    }, 250);
    document.body.style.height = 'auto';
    // this.initSectionObserver();
  }
}