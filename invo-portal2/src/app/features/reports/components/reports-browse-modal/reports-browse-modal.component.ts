import { Component, ElementRef, afterNextRender, computed, inject, signal, viewChild } from '@angular/core';
import { DomSanitizer } from '@angular/platform-browser';
import { TranslateModule } from '@ngx-translate/core';
import { LanguageService } from '@core/i18n/language.service';
import { PrivilegeService } from '@core/auth/privileges/privilege.service';
import { CompanyService } from '@core/auth/company.service';
import { isEmployeeEarningsEnabled } from '@core/auth/employee-earnings';
import { MODAL_DATA, MODAL_REF } from '@shared/modal/modal.tokens';
import { ModalRef } from '@shared/modal/modal.service';
import { REPORT_CATALOG } from '../../models/report-catalog';
import { groupAccent } from '../../models/report-accents';
import { reportIcon } from '../../models/report-icons';
import { ReportGroup } from '../../models/report.model';
import { ReportsFavoritesService } from '../../services/reports-favorites.service';

export interface ReportsBrowseData { currentSlug: string; }

/**
 * "Browse reports" picker (legacy header button): search + favourites-only
 * filter over every report the user may open, grouped by category. Closes with
 * the chosen report's slug; the caller navigates. Shared by all report pages.
 */
@Component({
  selector: 'app-reports-browse-modal',
  standalone: true,
  imports: [TranslateModule],
  templateUrl: './reports-browse-modal.component.html',
  styles: [`:host { display: flex; flex-direction: column; flex: 1 1 auto; min-height: 0; height: 100%; }`],
})
export class ReportsBrowseModalComponent {
  private listBox = viewChild<ElementRef<HTMLElement>>('listBox');

  constructor() {
    // the saved copy of the company settings can predate the Commission / Tips switches: refresh it so those reports show
    void this.company.loadSettings(true);
    // Open with the current report at the top of the list (not hidden somewhere down a long list).
    afterNextRender(() => {
      const box = this.listBox()?.nativeElement;
      const cur = box?.querySelector<HTMLElement>('[data-current]');
      if (box && cur) box.scrollTop = cur.offsetTop - box.offsetTop - 52; // clear of the sticky group band
    });
  }

  private ref = inject(MODAL_REF) as ModalRef<string | undefined>;
  private lang = inject(LanguageService);
  private privileges = inject(PrivilegeService);
  private company = inject(CompanyService);
  readonly favs = inject(ReportsFavoritesService);
  readonly data = inject(MODAL_DATA) as ReportsBrowseData;

  search = signal('');
  onlyFavorites = signal(false);

  /** Categories with only the reports this user can open (same gating as the catalog). */
  private allowed = computed<ReportGroup[]>(() =>
    REPORT_CATALOG
      .map(g => ({
        ...g,
        reports: g.reports.filter(r =>
          (!r.permission || this.privileges.check(r.permission))
          && (!r.earningsFeature || isEmployeeEarningsEnabled(this.company.settings(), r.earningsFeature))),
      }))
      .filter(g => g.reports.length > 0),
  );

  private sanitizer = inject(DomSanitizer);
  accent = groupAccent;
  /** The group's icon — our own static SVG, which Angular's HTML sanitizer would otherwise strip. */
  icon = (name?: string) => this.sanitizer.bypassSecurityTrustHtml(reportIcon(name));
  groups = computed<ReportGroup[]>(() => {
    const q = this.search().trim().toLowerCase();
    const fav = this.onlyFavorites();
    const favSet = new Set(this.favs.slugs());
    return this.allowed()
      .map(g => ({
        ...g,
        reports: g.reports.filter(r =>
          (!fav || favSet.has(r.slug))
          && (!q || this.lang.instant(r.titleKey).toLowerCase().includes(q))),
      }))
      .filter(g => g.reports.length > 0);
  });

  visibleCount = computed(() => this.groups().reduce((n, g) => n + g.reports.length, 0));
  totalCount = computed(() => this.allowed().reduce((n, g) => n + g.reports.length, 0));

  isFavorite = (slug: string) => this.favs.slugs().includes(slug);

  toggleFavorite(slug: string, e: Event): void {
    e.stopPropagation();
    this.favs.toggle(slug);
  }
  pick(slug: string): void { this.ref.close(slug); }
  close(): void { this.ref.dismiss(); }
}
