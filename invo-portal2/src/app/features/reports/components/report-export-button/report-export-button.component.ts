import { Component, HostListener, input, output, signal } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';

export type ExportFormat = 'pdf' | 'xlsx' | 'csv';

/**
 * Export button for report pages (legacy `<app-export-button>`): a solid button that opens a
 * "Choose format" menu — each format with an icon and a one-line description, a spinner on the
 * one being exported — plus an optional Print entry. It only reports what the user picked; the
 * page performs the export and passes `busy` back while it runs.
 *
 * Outside clicks and Escape close the menu. The menu is a fixed full-screen backdrop plus an
 * absolutely positioned panel, so it never gets clipped by a scrolling parent.
 */
@Component({
  selector: 'app-report-export-button',
  standalone: true,
  imports: [TranslateModule],
  templateUrl: './report-export-button.component.html',
  styleUrl: './report-export-button.component.scss',
})
export class ReportExportButtonComponent {
  formats = input<ExportFormat[]>(['pdf', 'xlsx']);
  /** Offer a Print entry under the formats. */
  printable = input(true);
  /** The format currently being exported (spinner + disabled menu), or null. */
  busy = input<ExportFormat | null>(null);

  exportAs = output<ExportFormat>();
  print = output<void>();

  open = signal(false);

  toggle(): void { if (!this.busy()) this.open.update(v => !v); }
  close(): void { this.open.set(false); }

  pick(f: ExportFormat): void {
    this.close();
    this.exportAs.emit(f);
  }
  doPrint(): void {
    this.close();
    this.print.emit();
  }

  @HostListener('document:keydown.escape')
  onEscape(): void { this.close(); }
}
