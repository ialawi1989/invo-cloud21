import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';

import { ModalRef } from '@shared/modal/modal.service';
import { MODAL_REF } from '@shared/modal/modal.tokens';
import { ModalHeaderComponent } from '@shared/modal/modal-header.component';
import { ModalFooterComponent } from '@shared/modal/modal-footer.component';

export interface ImportBarcodesResult {
  /** Cleaned, deduped list of barcode strings the user entered. */
  barcodes: string[];
}

/**
 * Import Barcodes modal.
 * ──────────────────────
 * Two input modes side-by-side: paste a list of barcodes (one per
 * line, or comma-separated, or whitespace-separated) and/or pick a
 * CSV file. Both feed the same parser; the parser strips a leading
 * `barcode` header row, dedupes, and trims whitespace.
 *
 * Returns `{ barcodes: string[] }` on submit. The caller then runs
 * `getBarcodesProducts(barcodes, branchId)` to look them up in
 * batch — keeps this modal isolated from product / branch concerns.
 */
@Component({
  selector: 'app-import-barcodes-modal',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    TranslateModule,
    ModalHeaderComponent,
    ModalFooterComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './import-barcodes-modal.component.html',
  styleUrl: './import-barcodes-modal.component.scss',
})
export class ImportBarcodesModalComponent {
  ref = inject<ModalRef<ImportBarcodesResult>>(MODAL_REF);

  pasted   = signal<string>('');
  fileName = signal<string>('');

  parsedCount = computed(() => this.parse(this.pasted()).length);

  /** Tokenise on newlines + commas + tabs + general whitespace.
   *  Drops blanks, the literal "barcode" header, and dedupes —
   *  case-insensitive on the header check, exact-match on the
   *  dedup so legitimate variants stay distinct. */
  private parse(text: string): string[] {
    if (!text) return [];
    const raw = text
      .split(/[\r\n,\t]+/)
      .map(s => s.trim())
      .filter(s => s.length > 0 && s.toLowerCase() !== 'barcode');
    const seen = new Set<string>();
    const out: string[] = [];
    for (const code of raw) {
      if (!seen.has(code)) {
        seen.add(code);
        out.push(code);
      }
    }
    return out;
  }

  onFile(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    this.fileName.set(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result ?? '');
      // Append (don't replace) so pasted values + file values can
      // be combined in one import. Newline separator keeps the
      // parser's tokeniser happy regardless of file format.
      const merged = this.pasted() ? this.pasted() + '\n' + text : text;
      this.pasted.set(merged);
    };
    reader.readAsText(file);
    // Reset the file input so picking the same file twice in a row
    // still re-fires `change`.
    input.value = '';
  }

  apply(): void {
    const barcodes = this.parse(this.pasted());
    if (!barcodes.length) return;
    this.ref.close({ barcodes });
  }

  cancel(): void { this.ref.dismiss(); }
}
