import { Component, EventEmitter, Input, Output, OnDestroy} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { AppServices } from 'src/app/services/appServices';
import { SearchService } from 'src/app/services/searchService/search.service';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

@Component({
  selector: 'app-pagination',
  imports: [TranslateModule],
  templateUrl: './pagination-component.component.html',
  styleUrl: './pagination-component.component.css'
})

export class PaginationComponent implements OnDestroy {
  private destroy$ = new Subject<void>();

  @Input() totalPages = 1;
  @Input() startIndex = 1;
  @Input() lastIndex = 1;
  @Input() pageRoute = "";
  @Input() clean = false;

  isReady = false
  @Output() pageChange = new EventEmitter<number>();

  query = '';
  currentPage: number = 1;
  pages: (number | string)[] = [];

  constructor(
    private searchService: SearchService,
    private route: ActivatedRoute,
    private router: Router,
    public appService: AppServices
  ) { }

  ngOnInit() {

    this.route.queryParams.pipe(takeUntil(this.destroy$)).subscribe(params => {
      const newPage = Number(+params['page']) || 1;
      this.currentPage = newPage;
      if (this.pageRoute === 'search') {
        this.generatePageNumbers();
        return;
      }
    });


    this.searchService.searchQuery$.pipe(takeUntil(this.destroy$)).subscribe((query) => {

      if (this.query !== query && query !== '') {
        this.query = query;
      }

    });

    this.route.queryParams.pipe(takeUntil(this.destroy$)).subscribe(params => {
      this.query = params['searchTerm'] ?? this.query;
      if (this.pageRoute !== 'search') {
        this.currentPage = Number(params['page']) ?? 1;
        if (!this.currentPage) this.currentPage = 1;
        this.generatePageNumbers();
      }

    });

  }

  ngOnChanges() {
    if (this.pageRoute === 'search') {
      this.route.queryParams.pipe(takeUntil(this.destroy$)).subscribe((params) => {
        const newPage = Number(+params['page']) || 1;
        this.currentPage = newPage;
        this.generatePageNumbers();
        return;
      });

      this.searchService.searchQuery$.pipe(takeUntil(this.destroy$)).subscribe((query) => {

        if (this.query !== query && query !== '') {
          this.query = query;
        }

      });

      return
    }
    if (this.clean) {
      this.currentPage = 1;
      this.navigateToPage(this.currentPage);
    }
    this.generatePageNumbers();
  }

  generatePageNumbers() {
    const maxVisiblePages = 3;
    const pages: (number | string)[] = [];
    const firstPage = 1;
    const lastPage = this.totalPages;


    if (this.totalPages <= maxVisiblePages) {
      for (let i = 1; i <= this.totalPages; i++) {
        pages.push(i);
      }
    } else {
      pages.push(firstPage);

      const start = Math.max(this.currentPage - 1, 2);
      const end = Math.min(this.currentPage + 1, this.totalPages - 1);
      if (start > 2) pages.push('...');
      for (let i = start; i <= end; i++) {
        pages.push(i);
      }
      if (end < this.totalPages - 1) pages.push('...');

      pages.push(lastPage);
    }
    this.pages = pages;
  }


  changePage(page: number | string) {

    if (typeof page !== 'number' ||
      Number.isNaN(page) ||
      page < 1 ||
      page > this.totalPages ||
      page === this.currentPage) {
      return;
    }

    this.currentPage = page;

    this.navigateToPage(this.currentPage);
    if (this.pageRoute !== 'search') this.generatePageNumbers();
    this.pageChange.emit(this.currentPage);

    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  private navigateToPage(page: number) {
    if (this.query === '' && this.pageRoute === 'search') return;

    const targetRoute = this.pageRoute === "search"
      ? ['/search']
      : this.pageRoute === 'shop-category'
        ? ['/shop', this.route.snapshot.paramMap.get('id')]
        : ['/shop'];

    if (this.pageRoute === 'search') {
      // Both searchTerm and page go in query params
      this.router.navigate(targetRoute, {
        queryParams: { searchTerm: this.query, page }
      });
    } else {
      // Shop routes — page belongs in query params
      const currentParams = { ...this.router.routerState.snapshot.root.queryParams };
      currentParams['page'] = page;
      this.router.navigate(targetRoute, { queryParams: currentParams });
    }
  }

  trackByIndex(index: number, item: number | string) {
    return item;
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}