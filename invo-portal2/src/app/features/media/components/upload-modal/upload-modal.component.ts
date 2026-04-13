import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MediaUploadComponent } from '../media-upload';
import { Media, IMediaUploadConfig } from '../../models/media.model';
import { MediaService } from '../../services/media.service';
import { MODAL_REF, MODAL_DATA } from '../../../../shared/modal/modal.tokens';
import { ModalRef } from '../../../../shared/modal/modal.service';
import { ModalHeaderComponent } from '../../../../shared/modal/modal-header.component';
import { UploadToastService } from '../../../../shared/components/upload-toast';

interface UploadModalData {
  config?: IMediaUploadConfig;
}

/**
 * Thin modal wrapper around MediaUploadComponent.
 * Opens via ModalService.open() and returns uploaded Media[] on close.
 */
@Component({
  selector: 'app-upload-modal',
  standalone: true,
  imports: [CommonModule, MediaUploadComponent, ModalHeaderComponent],
  template: `
    <app-modal-header title="Upload Media" />

    <div class="p-6">
      <app-media-upload
        [config]="config"
        [allowMultiple]="true"
        [showPreview]="true"
        [autoUpload]="false"
        (uploadComplete)="onUploadComplete($event)"
        (uploadError)="onUploadError($event)" />
    </div>
  `,
})
export class UploadModalComponent {
  private ref          = inject<ModalRef<Media[]>>(MODAL_REF);
  private data         = inject<UploadModalData | null>(MODAL_DATA, { optional: true });
  private mediaService = inject(MediaService);

  config: IMediaUploadConfig = this.data?.config ?? {
    maxFileSize: MediaService.MAX_FILE_SIZE,
    compressionEnabled: true,
    compressionQuality: 0.8,
  };

  private uploadToast = inject(UploadToastService);

  onUploadComplete(media: Media[]): void {
    for (const m of media) {
      this.uploadToast.add({
        id: m.id || `upload-${Date.now()}`,
        name: m.name,
        size: this.mediaService.formatBytes(m.size?.size || 0),
        status: 'completed',
        progress: 100,
      });
    }
    this.ref.close(media);
  }

  onUploadError(error: string): void {
    console.error('Upload error:', error);
  }
}
