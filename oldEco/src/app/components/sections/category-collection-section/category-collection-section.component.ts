import { Component, HostListener, Input, OnChanges, OnDestroy, SimpleChanges, inject } from '@angular/core';
import { LoggerService } from 'src/app/services/logger/logger.service';
import { Router } from '@angular/router';
import { CategoryCollectionStyle1Component } from './category-collection-style1/category-collection-style1.component';
import { CategoryCollectionStyle2Component } from "./category-collection-style2/category-collection-style2.component";
import { CategoryCollectionStyle3Component } from "./category-collection-style3/category-collection-style3.component";
import { CategoryCollectionStyle4Component } from "./category-collection-style4/category-collection-style4.component";
import { CategoryCollectionStyle5Component } from "./category-collection-style5/category-collection-style5.component";
import { Section } from '../../../models/page-data/pageData';
import { ThemeService } from '../../../services/themeServices/theme.service';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

@Component({
  selector: 'app-category-collection-section',
  imports: [
    CategoryCollectionStyle1Component,
    CategoryCollectionStyle2Component,
    CategoryCollectionStyle3Component,
    CategoryCollectionStyle4Component,
    CategoryCollectionStyle5Component,
  ],
  templateUrl: './category-collection-section.component.html',
  styleUrl: './category-collection-section.component.css'
})
export class CategoryCollectionSectionComponent implements OnChanges, OnDestroy {
  private destroy$ = new Subject<void>();

  private logger = inject(LoggerService);

  @Input() style = "Style 1";
  @Input() section!: Section;

  // ── Shared state passed down to style children ────────────────────────────
  background: string = 'white';
  isDataLoaded = false;

  constructor(
    private router: Router,
    private themeService: ThemeService,
  ) {}

  ngOnChanges(changes: SimpleChanges) {
    if (changes['section'] && this.section) {
      this.background = this.getBackground();
      this.isDataLoaded = false;
    }
  }

  ngOnInit() {
    this.checkVisibility();
  }

  @HostListener('window:scroll', [])
  @HostListener('window:resize', [])
  onWindowEvent(): void { this.checkVisibility(); }

  checkVisibility() {
    if (this.section?.show && !this.isDataLoaded) {
      this.isDataLoaded = true;
      this.loadCollectionData();
    }
  }

  // ── Shared helpers ────────────────────────────────────────────────────────

  getBackground(): string {
    const bg = this.section?.sectionBackground;
    if (!bg) return 'white';
    if (bg.style === 'Color' && bg.defaultColor) return bg.defaultColor;
    if (bg.style === 'Pattern' && bg.defaultPattern)
      return `url(assets/images/page-builder/patterns/ ${bg.defaultPattern} .png)`;
    if (bg.style === 'Image' && bg.defaultImage?.defaultUrl)
      return `url( ${bg.defaultImage.defaultUrl})`;
    return 'white';
  }

  gotoShop(category: any) {
    if (category.type === 'menu') return;
    this.router.navigate(['/shop'], {
      queryParams: { page: 1, categoryId: category.id, departmentId: category.departmentId }
    });
    window.scrollTo({ top: 0 });
  }

  loadCollectionData(): Promise<any> {
    return new Promise((resolve) => {
      const ids: any[] = (this.section.sectionData?.categories ?? []).map((c: any) => c.id);
      this.themeService.getSectionData({ type: 'category', ids }).pipe(takeUntil(this.destroy$)).subscribe({
        next: (data: any) => {
          if (data) {
            data.forEach((fetched: any) => {
              this.section.sectionData?.categories?.forEach((cat: any) => {
                if (fetched.id === cat.id) {
                  cat.title       = fetched.name;
                  cat.translation = fetched.translation;
                  cat.mediaUrl    = fetched.mediaUrl;
                  cat.departmentId = fetched.departmentId;
                }
              });
            });
            resolve(data);
          } else { resolve(false); }
        },
        error: (err: any) => {
          this.logger.error(err?.message, { stack: err?.stack, context: 'CategoryCollectionSectionComponent.loadCollectionData' });
          resolve(false);
        },
      });
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

}
