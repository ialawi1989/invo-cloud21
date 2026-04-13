import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MODAL_REF, MODAL_DATA } from '../../../../shared/modal/modal.tokens';
import { ModalRef } from '../../../../shared/modal/modal.service';
import { ModalHeaderComponent } from '../../../../shared/modal/modal-header.component';
import { ModalFooterComponent } from '../../../../shared/modal/modal-footer.component';
import { SpinnerComponent } from '../../../../shared/components/spinner';
import { MediaService } from '../../services/media.service';
import { Media } from '../../models/media.model';

/**
 * A modal that asks for an image URL, fetches the image, uploads it as a
 * new media item to the server, and returns the created Media object.
 *
 * Returns `Media` on success, `undefined` on dismiss/cancel.
 */
export interface UrlModalConfig {
  title?: string;
  label?: string;
  placeholder?: string;
  mediaType?: string;
}

@Component({
  selector: 'app-image-url-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, ModalHeaderComponent, ModalFooterComponent, SpinnerComponent],
  template: `
    <app-modal-header [title]="config?.title || 'Add image link (URL)'" />

    <div class="body">
      <label class="label">{{ config?.label || 'Image URL' }}</label>
      <input
        type="url"
        class="input"
        [placeholder]="config?.placeholder || 'https://example.com/image.jpg'"
        [(ngModel)]="url"
        (keydown.enter)="save()"
        [disabled]="uploading()"
        autofocus />
      @if (url() && !isValidUrl()) {
        <p class="error">Please enter a valid URL</p>
      }
      @if (uploadError()) {
        <p class="error">{{ uploadError() }}</p>
      }

      <!-- Preview -->
      @if (url() && isValidUrl() && !uploadError()) {
        <div class="preview">
          <img [src]="url()" (error)="onPreviewError()" alt="Preview" />
        </div>
      }
    </div>

    <app-modal-footer>
      <button class="btn-cancel" (click)="ref.dismiss()" [disabled]="uploading()">Cancel</button>
      <button class="btn-save" [disabled]="!url() || !isValidUrl() || uploading()" (click)="save()">
        @if (uploading()) {
          <app-spinner size="xs" />
          Uploading…
        } @else {
          <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
            <path d="M5 13l4 4L19 7"/>
          </svg>
          Save
        }
      </button>
    </app-modal-footer>
  `,
  styles: [`
    .body { padding: 20px 24px; }
    .label { display: block; font-size: 13px; font-weight: 500; color: #334155; margin-bottom: 6px; }
    .input {
      width: 100%; height: 42px; border: 1px solid #e2e8f0; border-radius: 8px;
      padding: 0 14px; font-size: 14px; font-family: inherit; color: #0f172a;
      background: #fff; outline: none; box-sizing: border-box;
    }
    .input:focus { border-color: var(--color-brand-500); box-shadow: 0 0 0 3px rgba(50,172,193,.12); }
    .input:disabled { opacity: .6; cursor: not-allowed; }
    .error { font-size: 12px; color: #dc2626; margin: 6px 0 0; }
    .preview {
      margin-top: 12px; border: 1px solid #e2e8f0; border-radius: 8px;
      overflow: hidden; max-height: 200px; display: flex;
      align-items: center; justify-content: center; background: #f8fafc;
    }
    .preview img { max-width: 100%; max-height: 200px; object-fit: contain; }
    .btn-cancel {
      padding: 9px 20px; background: #f3f4f6; border: 1px solid #e5e7eb;
      border-radius: 8px; font-size: 13px; cursor: pointer; font-family: inherit;
    }
    .btn-cancel:hover { background: #e5e7eb; }
    .btn-cancel:disabled { opacity: .6; cursor: not-allowed; }
    .btn-save {
      padding: 9px 24px; background: var(--color-brand-600); color: #fff;
      border: none; border-radius: 8px; font-size: 13px; font-weight: 600;
      cursor: pointer; font-family: inherit;
      display: inline-flex; align-items: center; gap: 8px;
    }
    .btn-save:hover { background: var(--color-brand-700); }
    .btn-save:disabled { opacity: .5; cursor: not-allowed; }
  `]
})
export class ImageUrlModalComponent {
  ref = inject<ModalRef<Media | undefined>>(MODAL_REF);
  config = inject<UrlModalConfig>(MODAL_DATA, { optional: true });
  private mediaService = inject(MediaService);

  url = signal('');
  uploading = signal(false);
  uploadError = signal('');

  isValidUrl(): boolean {
    const v = this.url().trim();
    if (!v) return false;
    try { new URL(v); return true; } catch { return false; }
  }

  onPreviewError(): void {
    this.uploadError.set('Could not load image from this URL');
  }

  async save(): Promise<void> {
    const imageUrl = this.url().trim();
    if (!imageUrl || !this.isValidUrl()) return;

    this.uploading.set(true);
    this.uploadError.set('');

    try {
      // Try to fetch + upload (may fail due to CORS on external URLs)
      const media = await this.fetchAndUpload(imageUrl);
      if (media) {
        this.ref.close(media);
        return;
      }
    } catch {
      // CORS or network error — fall back to storing the URL directly
    }

    // Fallback: return a synthetic Media-like object with the external URL.
    // The image will be served from the external source.
    this.uploading.set(false);
    const fallback = new Media({
      name: this.extractFileName(imageUrl, 'jpg'),
      url: { defaultUrl: imageUrl, thumbnail: imageUrl } as any,
      contentType: 'image',
    });
    this.ref.close(fallback);
  }

  /** Try to fetch the image client-side and upload to the server. */
  private async fetchAndUpload(imageUrl: string): Promise<Media | null> {
    const response = await fetch(imageUrl);
    if (!response.ok) throw new Error(`Fetch failed: ${response.status}`);

    const blob = await response.blob();
    if (!blob.type.startsWith('image/')) throw new Error('Not an image');

    const ext = blob.type.split('/')[1] || 'png';
    const fileName = this.extractFileName(imageUrl, ext);
    const file = new File([blob], fileName, { type: blob.type });

    const result = await this.mediaService.uploadFile(file);
    if (result.success && result.data && result.data.length > 0) {
      return result.data[0];
    }
    return null;
  }

  private extractFileName(url: string, fallbackExt: string): string {
    try {
      const pathname = new URL(url).pathname;
      const lastSegment = pathname.split('/').pop() || '';
      if (lastSegment && lastSegment.includes('.')) return lastSegment;
      return `imported-image-${Date.now()}.${fallbackExt}`;
    } catch {
      return `imported-image-${Date.now()}.${fallbackExt}`;
    }
  }
}
