import { Component, computed, inject, signal } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';
import { LanguageService } from '@core/i18n/language.service';
import { MODAL_DATA, MODAL_REF } from '@shared/modal/modal.tokens';
import { ModalRef } from '@shared/modal/modal.service';
import { ReportColumnDef, getReportColumns } from './report-columns';

export interface ReportColumnsModalData { slug: string; selected: string[]; }

/** "Customize columns" dialog (legacy column selector). At least one column stays on. */
@Component({
  selector: 'app-report-columns-modal',
  standalone: true,
  imports: [TranslateModule],
  templateUrl: './report-columns-modal.component.html',
  styles: [`:host { display: flex; flex-direction: column; flex: 1 1 auto; min-height: 0; height: 100%; }`],
})
export class ReportColumnsModalComponent {
  private ref = inject(MODAL_REF) as ModalRef<string[] | undefined>;
  private data = inject(MODAL_DATA) as ReportColumnsModalData;
  private lang = inject(LanguageService);

  readonly columns: ReportColumnDef[] = getReportColumns(this.data.slug);
  selected = signal<string[]>([...this.data.selected]);
  canApply = computed(() => this.selected().length > 0);
  allOn = computed(() => this.selected().length === this.columns.length);

  isOn = (key: string) => this.selected().includes(key);
  label = (c: ReportColumnDef) => (this.lang.current() === 'ar' ? c.label.ar : c.label.en);
  description = (c: ReportColumnDef) => (c.description ? (this.lang.current() === 'ar' ? c.description.ar : c.description.en) : '');

  toggle(key: string): void {
    const set = new Set(this.selected());
    set.has(key) ? set.delete(key) : set.add(key);
    // keep the report's own order, whatever order the user ticked them in
    this.selected.set(this.columns.filter(c => set.has(c.key)).map(c => c.key));
  }
  toggleAll(): void { this.selected.set(this.allOn() ? [] : this.columns.map(c => c.key)); }

  cancel(): void { this.ref.dismiss(); }
  apply(): void { if (this.canApply()) this.ref.close(this.selected()); }
}
