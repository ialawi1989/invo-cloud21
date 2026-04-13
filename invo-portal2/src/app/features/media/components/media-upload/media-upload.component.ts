import { Component, Input, Output, EventEmitter, OnInit, OnDestroy, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subject, takeUntil } from 'rxjs';

import { MediaService } from '../../services/media.service';
import { FileUploadItem, Media, IMediaUploadConfig } from '../../models/media.model';
import { UploadToastService } from '../../../../shared/components/upload-toast';

/**
 * Media Upload Component
 * Modern Angular 21 component with signals and standalone architecture
 * Features:
 * - Drag & drop file upload
 * - Progress tracking
 * - File validation
 * - Preview thumbnails
 * - Multiple file support
 */

@Component({
  selector: 'app-media-upload',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './media-upload.component.html',
  styleUrls: ['./media-upload.component.scss']
})
export class MediaUploadComponent implements OnInit, OnDestroy {
  @Input() config: IMediaUploadConfig = {
    maxFileSize: MediaService.MAX_FILE_SIZE,
    compressionEnabled: true,
    compressionQuality: 0.8
  };

  @Input() allowMultiple = true;
  @Input() showPreview = true;
  @Input() autoUpload = false;
  @Input() showProgress = true;

  @Output() filesSelected = new EventEmitter<File[]>();
  @Output() uploadComplete = new EventEmitter<Media[]>();
  @Output() uploadError = new EventEmitter<string>();

  // Signals for reactive state
  isDragging = signal(false);
  selectedFiles = signal<File[]>([]);
  uploadItems = signal<FileUploadItem[]>([]);
  isUploading = signal(false);

  private destroy$ = new Subject<void>();

  private uploadToast = inject(UploadToastService);

  constructor(public mediaService: MediaService) {}

  ngOnInit(): void {
    // Subscribe to upload queue changes
    this.mediaService.uploadQueue
      .pipe(takeUntil(this.destroy$))
      .subscribe(queue => {
        this.uploadItems.set(queue);
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ==================== FILE SELECTION ====================

  onFileInputChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      this.handleFiles(Array.from(input.files));
    }
  }

  // ==================== DRAG & DROP ====================

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging.set(true);
  }

  onDragLeave(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging.set(false);
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging.set(false);

    if (event.dataTransfer?.files) {
      this.handleFiles(Array.from(event.dataTransfer.files));
    }
  }

  // ==================== FILE HANDLING ====================

  private handleFiles(files: File[]): void {
    if (!this.allowMultiple && files.length > 1) {
      files = [files[0]];
    }

    // Validate files
    const validationResults = this.mediaService.validateFiles(files, this.config);
    const validFiles: File[] = [];
    const errors: string[] = [];

    files.forEach(file => {
      const error = validationResults.get(file.name);
      if (error) {
        errors.push(`${file.name}: ${error}`);
      } else {
        validFiles.push(file);
      }
    });

    if (errors.length > 0) {
      this.uploadError.emit(errors.join('\n'));
    }

    if (validFiles.length > 0) {
      this.selectedFiles.set([...this.selectedFiles(), ...validFiles]);
      this.filesSelected.emit(validFiles);

      if (this.autoUpload) {
        this.uploadFiles();
      }
    }
  }

  // ==================== UPLOAD ====================

  async uploadFiles(): Promise<void> {
    const files = this.selectedFiles();
    if (files.length === 0) return;

    this.isUploading.set(true);
    const uploadedMedia: Media[] = [];

    // Add all files to toast as "uploading" BEFORE starting
    const toastIds: Map<File, string> = new Map();
    for (const file of files) {
      const toastId = `upload-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      toastIds.set(file, toastId);
      this.uploadToast.add({
        id: toastId,
        name: file.name,
        size: this.mediaService.formatBytes(file.size),
        status: 'uploading',
        progress: 0,
      });
    }

    try {
      for (const file of files) {
        const toastId = toastIds.get(file)!;

        // Simulate initial progress
        this.uploadToast.update(toastId, { progress: 10 });

        try {
          // Mid-upload progress
          this.uploadToast.update(toastId, { progress: 40 });

          const result = await this.mediaService.uploadFile(file, this.config);

          if (result.success && result.data) {
            uploadedMedia.push(...result.data);
            this.uploadToast.complete(toastId);
          } else {
            this.uploadToast.fail(toastId, result.error || 'Upload failed');
            this.uploadError.emit(result.error || result.message || `Failed to upload ${file.name}`);
          }
        } catch (error: any) {
          this.uploadToast.fail(toastId, error.message || 'Upload failed');
          this.uploadError.emit(error.message || 'Upload failed');
        }
      }

      if (uploadedMedia.length > 0) {
        this.uploadComplete.emit(uploadedMedia);
      } else if (files.length > 0) {
        this.uploadError.emit('All uploads failed');
      }
      this.clearSelection();
    } finally {
      this.isUploading.set(false);
    }
  }

  // ==================== FILE MANAGEMENT ====================

  removeFile(index: number): void {
    const files = this.selectedFiles();
    files.splice(index, 1);
    this.selectedFiles.set([...files]);
  }

  clearSelection(): void {
    this.selectedFiles.set([]);
  }

  cancelUpload(uploadId: string): void {
    this.mediaService.cancelUpload(uploadId);
  }

  // ==================== UTILITY ====================

  getFilePreview(file: File): string {
    if (this.mediaService.isImageFile(file)) {
      return URL.createObjectURL(file);
    }
    return '';
  }

  /**
   * Returns a category key for icon rendering (used by the template's `@switch`).
   * Outline SVGs for each category are inline in the template.
   */
  getFileIconKind(file: File): 'pdf' | 'doc' | 'sheet' | 'archive' | 'file' {
    const ext = this.mediaService.extractExtension(file.name).toLowerCase();
    if (ext === 'pdf') return 'pdf';
    if (['doc', 'docx', 'rtf', 'txt'].includes(ext)) return 'doc';
    if (['xls', 'xlsx', 'ppt', 'pptx', 'csv'].includes(ext)) return 'sheet';
    if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext)) return 'archive';
    return 'file';
  }

  formatFileSize(bytes: number): string {
    return this.mediaService.formatBytes(bytes);
  }

  getUploadStatus(item: FileUploadItem): string {
    switch (item.status) {
      case 'pending':
        return 'Waiting...';
      case 'uploading':
        return `Uploading... ${item.progress}%`;
      case 'completed':
        return 'Completed';
      case 'failed':
        return `Failed: ${item.error || 'Unknown error'}`;
      case 'cancelled':
        return 'Cancelled';
      default:
        return '';
    }
  }
}
