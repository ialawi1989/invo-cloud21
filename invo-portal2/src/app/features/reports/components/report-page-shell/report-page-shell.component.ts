import { Component, ElementRef, input, output, viewChild } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';

/**
 * The page frame EVERY report uses, so they all look and behave the same: a white action bar (Back, Browse Reports,
 * Refresh, favourite, Export), a white title strip (title, description, applied-filter chips) and a scrolling content
 * area. The report page supplies the title text, the export button and the content; the frame supplies the layout.
 *
 * Projected slots:
 *  - `[shellExport]`      the export button (right end of the action bar)
 *  - `[shellTitleExtra]`  right side of the title line (e.g. the applied-filter chips)
 *  - default              the content (filter bar, KPIs, table …)
 */
@Component({
  selector: 'app-report-page-shell',
  standalone: true,
  imports: [TranslateModule],
  templateUrl: './report-page-shell.component.html',
  styleUrl: './report-page-shell.component.scss',
})
export class ReportPageShellComponent {
  title = input.required<string>();
  /** A small pill after the title (e.g. the account of a drill-down). */
  titleChip = input<string>('');
  subtitle = input<string>('');
  /** Show the favourite star. */
  showFavorite = input(true);
  favorite = input(false);
  /** Spin the refresh icon. */
  spinning = input(false);

  back = output<void>();
  browse = output<void>();
  refresh = output<void>();
  favoriteToggle = output<void>();

  /** The scrolling area — pages observe it (e.g. to know when their filter bar scrolled out of view). */
  contentArea = viewChild<ElementRef<HTMLElement>>('contentArea');
}
