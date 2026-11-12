import { Component, computed, input } from '@angular/core';

/**
 * Loading placeholder shaped like the report it stands in for: optional stat tiles, an optional chart
 * card and a table (header band + rows). Each report passes its own shape so the page does not jump
 * when the data arrives.
 */
@Component({
  selector: 'app-report-skeleton',
  standalone: true,
  templateUrl: './report-skeleton.component.html',
  styleUrl: './report-skeleton.component.scss',
})
export class ReportSkeletonComponent {
  /** Number of stat tiles above the table (0 = none). */
  kpis = input(0);
  /** Show a chart card between the tiles and the table. */
  chart = input(false);
  /** Table columns (0 hides the table). */
  columns = input(5);
  rows = input(8);

  tiles = computed(() => Array.from({ length: this.kpis() }, (_, i) => i));
  cols = computed(() => Array.from({ length: Math.min(Math.max(this.columns(), 0), 12) }, (_, i) => i));
  body = computed(() => Array.from({ length: this.rows() }, (_, i) => i));
  /** Tiles per row: up to 5 across, as the KPI row does. */
  tileCols = computed(() => Math.min(Math.max(this.kpis(), 1), 5));
  /** Varied widths so the cells read as text rather than a grid of equal bars. */
  w(r: number, c: number): number { return c === 0 ? 55 + ((r * 13) % 35) : 40 + (((r + 1) * (c + 3) * 7) % 45); }
}
