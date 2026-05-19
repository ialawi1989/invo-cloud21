import { Component, inject, OnInit, OnDestroy, Inject, PLATFORM_ID, HostListener } from '@angular/core';
import { Router } from '@angular/router';
import { BehaviorSubject, Observable, Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { Company } from 'src/app/models/company.model';
import { PageData } from 'src/app/models/page-data/pageData';
import { AppServices } from 'src/app/services/appServices';
import { CompanyServices } from 'src/app/services/companyServices/company.service';
import { PageBuilderService } from 'src/app/services/pageBuilderServices/page-builder.service';
import { ServiceRequestService } from 'src/app/services/serviceRequestServices/serviceRequest.service';
import { ServiceRequestPopComponent } from "../../pages/pager/service-request-pop/service-request-pop.component";
import { isPlatformBrowser } from '@angular/common';

@Component({
  selector: 'app-toolbar-buttons',
  imports: [ServiceRequestPopComponent],
  providers: [ServiceRequestService],
  templateUrl: './toolbar-buttons.component.html',
  styleUrl: './toolbar-buttons.component.css'
})
export class ToolBarButtonsComponent implements OnInit, OnDestroy {


  private serviceRequestService = inject(ServiceRequestService);
  public appService = inject(AppServices);
  public pageBuilderServices = inject(PageBuilderService);
  public router = inject(Router);

  private destroy$ = new Subject<void>();
  companyData: Company = new Company();
  pageSection: PageData | any = new PageData();


  private pageDataSubject = new BehaviorSubject<PageData | null>(null);
  private currentPageSlug: string = '';
  private pageCache = new Map<string, Observable<any>>();

  // Observable that other components can subscribe to
  pageData$ = this.pageDataSubject.asObservable();
  isBrowser: boolean;

  constructor(
    @Inject(PLATFORM_ID) private platformId: any,
    private companyService: CompanyServices
  ) {
    this.isBrowser = isPlatformBrowser(this.platformId);
    this.getCompanyData();
  }

  ngOnInit() {
    this.initializePageData();
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private async initializePageData() {
    if (this.appService.serviceName == 'DineIn') {
      const currentPageSlug = this.router.url.split('/')[1];

      // First, check if data is already available in the service
      const currentData = this.pageBuilderServices.getCurrentPageData();
      const currentSlug = this.pageBuilderServices.getCurrentPageSlug();

      if (currentData && currentSlug === currentPageSlug) {
        // Data is already available and matches current page
        this.pageSection = currentData;
      } else if (this.pageBuilderServices.isCached(currentPageSlug)) {
        // Data is cached, get it (this won't make API call)
        let data = await this.pageBuilderServices.getPage(currentPageSlug)
        this.pageSection = data;
      }

      // Access reactive data
      this.pageSection = this.pageBuilderServices.pageData; // ReadonlySignal<PageData | null>

    }
  }

  isHomePage() {
    if (this.isBrowser) {
      return window.location.pathname === '/' || window.location.pathname === '';
    } else {
      return null;
    }
  }

  isMenu() {
    if (this.isBrowser) {
      return window.location.pathname === '/menu';
    } else {
      return null;
    }
  }

  getCompanyData() {
    this.companyService.companyData$
      .pipe(takeUntil(this.destroy$))
      .pipe(takeUntil(this.destroy$)).subscribe({
        next: (data: Company) => {
          this.companyData = data;
        },
      });
  }

  scrollToTop(): void {
    if (this.isBrowser) {
      window.scrollTo({
        top: 0,
        behavior: 'smooth'
      });
    }
  }

  callWaiter() {
    this.serviceRequestService.showServiceRequestPop();
  }

  showGoToUp: boolean = false;
  @HostListener('window:scroll', [])
  onWindowScroll() {
    const scrollOffset = window.scrollY;

    this.showGoToUp = scrollOffset >= 100;
  }

  isMenuPage(){
    return this.router.url.includes('/menu');
  }
  
}
