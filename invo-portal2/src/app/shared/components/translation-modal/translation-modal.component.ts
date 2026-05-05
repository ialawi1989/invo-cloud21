import {
  ChangeDetectionStrategy,
  Component,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';

import { MODAL_DATA, MODAL_REF } from '@shared/modal/modal.tokens';
import type { ModalRef } from '@shared/modal/modal.service';

/** Per-language value pair — stable wire shape for `Translation.{field}`. */
export interface TranslationLang {
  en: string;
  ar: string;
}

export interface TranslationModalData {
  /** Current value to seed the form with — empty strings are fine. */
  initial?: Partial<TranslationLang>;
  /** Optional label shown under the modal title (e.g. "Branch name"). */
  label?: string;
}

/**
 * Translation modal
 * ─────────────────
 * Drop-in replacement for the legacy `<app-translation>` modal.
 * Edits a single field's English + Arabic copies side by side and
 * returns the resulting `{ en, ar }` on Save (or `null` on Cancel).
 *
 * The caller is responsible for writing the result back onto its
 * domain object (typically `entity.translation.<field>`) and
 * keeping the primary value (e.g. `entity.name`) in sync with
 * `result.en` so the wire shape matches the legacy backend.
 */
@Component({
  selector: 'app-translation-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslateModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './translation-modal.component.html',
  styleUrl: './translation-modal.component.scss',
})
export class TranslationModalComponent {
  private modalRef = inject<ModalRef<TranslationLang | null>>(MODAL_REF);
  private data     = inject<TranslationModalData>(MODAL_DATA);

  en = signal<string>(this.data?.initial?.en ?? '');
  ar = signal<string>(this.data?.initial?.ar ?? '');

  label = this.data?.label ?? '';

  save(): void {
    this.modalRef.close({
      en: this.en().trim(),
      ar: this.ar().trim(),
    });
  }

  cancel(): void {
    this.modalRef.close(null);
  }
}
