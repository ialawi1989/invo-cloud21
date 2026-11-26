import { Component, inject, signal } from '@angular/core';
import { MODAL_DATA, MODAL_REF } from '../../modal/modal.tokens';
import { ModalRef } from '../../modal/modal.service';
import { ImageEditorComponent } from './image-editor.component';

export interface ImageEditorModalData {
  /** URL of the image to edit. */
  imageUrl: string;
  /** Original file name (used for naming the saved blob). */
  fileName?: string;
  /** Starting crop preset ('r0' = 1:1 square). */
  initialCropPreset?: string;
  /**
   * The image is an existing library item. When true, Save asks "save as new" or "replace the original" and the modal
   * closes with an {@link ImageEditorSaveResult} instead of a bare Blob.
   */
  allowReplace?: boolean;
}

/** What the modal closes with when `allowReplace` is set. */
export interface ImageEditorSaveResult {
  blob: Blob;
  mode: 'new' | 'replace';
  /** Replace only: delete the original afterwards (false = keep it in the library as the old version). */
  deleteOriginal: boolean;
}

/**
 * Modal wrapper for the image editor.
 * Opens fullscreen. Returns a Blob of the edited image on save
 * (an ImageEditorSaveResult when `allowReplace` is set).
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
      [initialCropPreset]="data.initialCropPreset ?? 'free'"
      (save)="onSave($event)"
      (cancel)="ref.dismiss()" />

    @if (pending(); as blob) {
      <div class="sc-backdrop" (click)="pending.set(null)">
        <div class="sc-card" role="dialog" aria-modal="true" aria-labelledby="sc-title" (click)="$event.stopPropagation()">
          <h3 id="sc-title" class="sc-title">Save your edit</h3>

          <label class="sc-opt" [class.on]="mode() === 'new'">
            <input type="radio" name="sc-mode" [checked]="mode() === 'new'" (change)="mode.set('new')" />
            <span><b>Save as new image</b><small>The original stays as it is. Nothing that uses it changes.</small></span>
          </label>
          <label class="sc-opt" [class.on]="mode() === 'replace'">
            <input type="radio" name="sc-mode" [checked]="mode() === 'replace'" (change)="mode.set('replace')" />
            <span><b>Replace the original</b><small>Everything that uses the original (products, categories, employees…) switches to the edited image.</small></span>
          </label>

          @if (mode() === 'replace') {
            <label class="sc-check">
              <input type="checkbox" [checked]="!deleteOriginal()" (change)="deleteOriginal.set(!$any($event.target).checked)" />
              <span>Keep the original in the library as the old version</span>
            </label>
          }

          <div class="sc-actions">
            <button type="button" class="sc-btn" (click)="pending.set(null)">Back</button>
            <button type="button" class="sc-btn sc-btn--primary" (click)="confirm(blob)">
              {{ mode() === 'replace' ? 'Replace' : 'Save as new' }}
            </button>
          </div>
        </div>
      </div>
    }
  `,
  styles: [`
    :host { display: block; height: 100%; position: relative; }
    .sc-backdrop { position: absolute; inset: 0; z-index: 50; display: flex; align-items: center; justify-content: center;
      background: rgba(15, 23, 42, 0.45); }
    .sc-card { width: min(440px, calc(100% - 32px)); background: var(--ui-surface, #fff); border: 1px solid var(--ui-line, #e2e8f0);
      border-radius: 12px; padding: 20px; box-shadow: 0 20px 50px rgba(15, 23, 42, 0.25); display: flex; flex-direction: column; gap: 10px; }
    .sc-title { margin: 0 0 4px; font-size: 16px; font-weight: 600; color: var(--ui-text, #0f172a); }
    .sc-opt { display: flex; gap: 10px; align-items: flex-start; padding: 10px 12px; border: 1px solid var(--ui-line, #e2e8f0);
      border-radius: 8px; cursor: pointer; font-size: 13px; color: var(--ui-text, #0f172a); }
    .sc-opt.on { border-color: var(--color-brand-500, #32acc1); box-shadow: 0 0 0 3px rgba(50, 172, 193, 0.12); }
    .sc-opt input { margin-top: 3px; accent-color: var(--ui-brand-t700, #207484); }
    .sc-opt span { display: flex; flex-direction: column; gap: 2px; }
    .sc-opt small { color: var(--ui-faint, #64748b); font-size: 12px; }
    .sc-check { display: flex; gap: 8px; align-items: center; padding: 0 4px; font-size: 13px; color: var(--ui-text, #0f172a); cursor: pointer; }
    .sc-check input { accent-color: var(--ui-brand-t700, #207484); }
    .sc-actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 6px; }
    .sc-btn { padding: 8px 16px; border-radius: 8px; border: 1px solid var(--ui-line, #e2e8f0); background: var(--ui-surface, #fff);
      font: inherit; font-size: 13px; cursor: pointer; color: var(--ui-text, #0f172a); }
    .sc-btn--primary { background: var(--ui-brand-t700, #207484); border-color: var(--ui-brand-t700, #207484); color: #fff; font-weight: 600; }
  `],
})
export class ImageEditorModalComponent {
  data = inject<ImageEditorModalData>(MODAL_DATA);
  ref  = inject<ModalRef<Blob | ImageEditorSaveResult | undefined>>(MODAL_REF);

  /** The edited image waiting for the "new or replace" answer. */
  pending = signal<Blob | null>(null);
  mode = signal<'new' | 'replace'>('new');
  deleteOriginal = signal(false);

  onSave(blob: Blob): void {
    if (this.data.allowReplace) this.pending.set(blob);
    else this.ref.close(blob);
  }

  confirm(blob: Blob): void {
    const result: ImageEditorSaveResult = { blob, mode: this.mode(), deleteOriginal: this.mode() === 'replace' && this.deleteOriginal() };
    this.ref.close(result);
  }
}
