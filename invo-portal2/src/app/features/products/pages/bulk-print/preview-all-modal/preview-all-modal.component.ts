import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';

import { ModalRef } from '@shared/modal/modal.service';
import { MODAL_DATA, MODAL_REF } from '@shared/modal/modal.tokens';
import { ModalHeaderComponent } from '@shared/modal/modal-header.component';
import { ModalFooterComponent } from '@shared/modal/modal-footer.component';

import { LabelTemplate } from '../../../../label-builder/services/label-template.types';
import { renderTemplateToCanvas } from '../../../../label-builder/services/png-export';

export interface PreviewAllModalData {
  /** Pre-rendered PNG data URLs — one per label × qty. The page
   *  pre-renders so the modal opens instantly with the full grid;
   *  re-rendering inside the modal would block the open animation. */
  dataUrls: string[];
  /** Active template — drives the per-card aspect ratio and the
   *  metadata strip in the modal header. */
  template: LabelTemplate;
}

/**
 * Preview-All modal.
 * ──────────────────
 * Shows the full grid of every label that will print, at the
 * template's exact aspect ratio. Useful sanity check before the
 * print dialog opens — the user can see whether bindings resolved
 * correctly across products and whether quantities look right.
 *
 * The modal opens with the data URLs already rendered (the parent
 * builds them via `renderTemplateToCanvas` before opening), so it
 * doesn't recompute on every interaction.
 *
 * The Print button just resolves the modal with `'print'` and the
 * parent kicks off its existing print flow — keeps the print
 * pipeline in one place rather than duplicating the popup-window
 * setup here.
 */
@Component({
  selector: 'app-preview-all-modal',
  standalone: true,
  imports: [
    CommonModule,
    TranslateModule,
    ModalHeaderComponent,
    ModalFooterComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './preview-all-modal.component.html',
  styleUrl: './preview-all-modal.component.scss',
})
export class PreviewAllModalComponent {
  data = inject<PreviewAllModalData>(MODAL_DATA);
  ref  = inject<ModalRef<'print' | undefined>>(MODAL_REF);

  /** Aspect-ratio string for the card chrome — keeps every preview
   *  rendered at the exact label proportions regardless of the
   *  rendered PNG's pixel size. */
  aspectRatio = computed<string>(() => {
    const t = this.data.template;
    return `${t.labelWidth} / ${t.labelHeight}`;
  });

  totalCount = computed(() => this.data.dataUrls.length);

  print(): void  { this.ref.close('print'); }
  cancel(): void { this.ref.dismiss(); }

  // Re-export the renderer so the modal can do an on-demand re-
  // render if a future enhancement needs it (e.g. inline edits).
  protected readonly renderTemplateToCanvas = renderTemplateToCanvas;
}
