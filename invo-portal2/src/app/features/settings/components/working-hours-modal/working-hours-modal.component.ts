import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
} from '@angular/forms';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

import { ModalHeaderComponent } from '@shared/modal/modal-header.component';
import { MODAL_DATA, MODAL_REF } from '@shared/modal/modal.tokens';
import type { ModalRef } from '@shared/modal/modal.service';

import {
  WorkingHoursEditorComponent,
  DayHours,
} from '../working-hours-editor/working-hours-editor.component';

export interface WorkingHoursModalData {
  /** Translated heading for the modal title (e.g. "Edit working hours"). */
  title:    string;
  /** Translated subtitle / description shown under the heading. */
  subtitle?: string;
  /** Initial schedule. Missing days are filled with closed-day defaults. */
  initial:  DayHours[];
}

export type WorkingHoursModalResult = DayHours[];

/**
 * working-hours-modal
 * ───────────────────
 * Wraps `WorkingHoursEditorComponent` in a modal so the branch form's
 * card can stay slim (read-only summary + Edit button) and only show
 * the per-day controls when the user explicitly requests them.
 *
 * The editor needs a parent FormGroup to register its FormArray on, so
 * we own a throwaway one here. On Save we read `daysArray.getRawValue()`
 * back as `DayHours[]` and emit it to the caller; Cancel just dismisses
 * with no result, leaving the caller's data untouched.
 */
@Component({
  selector: 'app-working-hours-modal',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    TranslateModule,
    ModalHeaderComponent,
    WorkingHoursEditorComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './working-hours-modal.component.html',
  styleUrl: './working-hours-modal.component.scss',
})
export class WorkingHoursModalComponent {
  private fb        = inject(FormBuilder);
  private translate = inject(TranslateService);
  private modalRef  = inject<ModalRef<WorkingHoursModalResult>>(MODAL_REF);
  data              = inject<WorkingHoursModalData>(MODAL_DATA);

  /** The throwaway parent for the embedded editor. The editor registers
   *  its 7-day FormArray onto this under `schedule`. */
  form: FormGroup = this.fb.group({});

  /** Re-translate labels when the language changes. */
  private i18nTick = signal(0);

  saveLabel = computed<string>(() => {
    this.i18nTick();
    return this.translate.instant('COMMON.SAVE');
  });

  save(): void {
    // Validate everything before letting the user save — overlapping
    // periods or to<from on any day would otherwise round-trip silently.
    this.form.markAllAsTouched();
    if (this.form.invalid) return;
    const arr = this.form.get('schedule');
    if (!arr) { this.modalRef.dismiss(); return; }
    this.modalRef.close(arr.value as DayHours[]);
  }

  close(): void {
    this.modalRef.dismiss();
  }
}
