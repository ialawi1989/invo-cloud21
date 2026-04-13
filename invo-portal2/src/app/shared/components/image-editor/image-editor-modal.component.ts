import { Component, inject } from '@angular/core';
import { MODAL_DATA, MODAL_REF } from '../../modal/modal.tokens';
import { ModalRef } from '../../modal/modal.service';
import { ImageEditorComponent } from './image-editor.component';

export interface ImageEditorModalData {
  /** URL of the image to edit. */
  imageUrl: string;
  /** Original file name (used for naming the saved blob). */
  fileName?: string;
}

/**
 * Modal wrapper for the image editor.
 * Opens fullscreen. Returns a Blob of the edited image on save.
 *
 * Usage:
 *   const ref = modalService.open(ImageEditorModalComponent, {
 *     size: 'fullscreen',
 *     closeable: false,
 *     data: { imageUrl: media.imageUrl, fileName: media.name }
 *   });
 *   const blob = await ref.afterClosed();
 *   if (blob) { // upload blob as new media }
 */
@Component({
  selector: 'app-image-editor-modal',
  standalone: true,
  imports: [ImageEditorComponent],
  template: `
    <app-image-editor
      [imageUrl]="data.imageUrl"
      [fileName]="data.fileName ?? 'edited.png'"
      (save)="onSave($event)"
      (cancel)="ref.dismiss()" />
  `,
  styles: [`:host { display: block; height: 100%; }`],
})
export class ImageEditorModalComponent {
  data = inject<ImageEditorModalData>(MODAL_DATA);
  ref  = inject<ModalRef<Blob | undefined>>(MODAL_REF);

  onSave(blob: Blob): void {
    this.ref.close(blob);
  }
}
