import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';

import { MODAL_DATA, MODAL_REF } from '@shared/modal/modal.tokens';
import type { ModalRef } from '@shared/modal/modal.service';

import {
  CustomFieldType,
  FIELD_TYPE_CARDS,
  FieldTypeCard,
} from '../../models/custom-field.types';

export interface CustomFieldTypeModalData {
  /** Currently-selected type. The matching card is pre-highlighted. */
  initialType?: CustomFieldType;
}

/**
 * Choose-field-type modal
 * ───────────────────────
 * Same pattern as the Content Library "Choose field type" picker — a
 * card grid grouped by section, primary action commits the selection.
 *
 * Returns the picked `CustomFieldType` on confirm, `null` on cancel.
 */
@Component({
  selector: 'app-custom-field-type-modal',
  standalone: true,
  imports: [CommonModule, TranslateModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './custom-field-type-modal.component.html',
  styleUrl: './custom-field-type-modal.component.scss',
})
export class CustomFieldTypeModalComponent {
  private modalRef  = inject<ModalRef<CustomFieldType | null>>(MODAL_REF);
  private sanitizer = inject(DomSanitizer);
  private data      = inject<CustomFieldTypeModalData>(MODAL_DATA);

  readonly cards = FIELD_TYPE_CARDS;

  /** Tracks the user's pending pick — only committed when they hit "Choose". */
  selected = signal<CustomFieldType>(this.data?.initialType ?? 'text');

  essentialCards = computed<FieldTypeCard[]>(() =>
    this.cards.filter((c) => c.section === 'essentials'),
  );
  contactCards = computed<FieldTypeCard[]>(() =>
    this.cards.filter((c) => c.section === 'contact'),
  );
  timeCards = computed<FieldTypeCard[]>(() =>
    this.cards.filter((c) => c.section === 'time'),
  );

  pick(type: CustomFieldType): void {
    this.selected.set(type);
  }

  /** Pretty-print the icon — runs through DomSanitizer once per card. */
  iconHtml(card: FieldTypeCard): SafeHtml {
    return this.sanitizer.bypassSecurityTrustHtml(card.icon);
  }

  ok(): void {
    this.modalRef.close(this.selected());
  }

  cancel(): void {
    this.modalRef.close(null);
  }
}
