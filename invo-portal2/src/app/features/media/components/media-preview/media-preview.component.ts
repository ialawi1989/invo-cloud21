import { Component, Input, OnInit, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';

import { Media } from '../../models/media.model';
import { MediaService } from '../../services/media.service';
import { MODAL_REF, MODAL_DATA } from '../../../../shared/modal/modal.tokens';
import { ModalRef, ModalService } from '../../../../shared/modal/modal.service';
import { ImageEditorModalComponent, ImageEditorModalData } from '../../../../shared/components/image-editor';

interface PreviewModalData {
  media: Media;
  mediaList?: Media[];
  title?: string;
}

/**
 * Media Preview Modal Component
 * Previews images, documents, videos, and other media types
 */

@Component({
  selector: 'app-media-preview',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './media-preview.component.html',
  styleUrls: ['./media-preview.component.scss']
})
export class MediaPreviewComponent implements OnInit {
  @Input() media!: Media;
  @Input() mediaList: Media[] = [];
  @Input() title = 'Media Preview';

  // Inject modal system with proper typing
  private modalRef = inject<ModalRef | null>(MODAL_REF, { optional: true });
  private modalData = inject<PreviewModalData | null>(MODAL_DATA, { optional: true });

  // State
  currentIndex = signal(0);
  googleViewerUrl = signal<SafeResourceUrl | null>(null);
  pdfViewerUrl = signal<SafeResourceUrl | null>(null);
  isLocalPdf = signal(false);
  isLoading = signal(true);
  hasError = signal(false);

  // Supported document extensions for Google Viewer
  private readonly DOCUMENT_EXTENSIONS = ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx'];

  private modalSvc = inject(ModalService);

  constructor(
    private sanitizer: DomSanitizer,
    private mediaService: MediaService
  ) {}

  ngOnInit(): void {
    // Use modal data if provided, otherwise use @Input values
    if (this.modalData) {
      this.media = this.modalData.media || this.media;
      this.mediaList = this.modalData.mediaList || this.mediaList;
      this.title = this.modalData.title || this.title;
    }

    if (this.mediaList.length > 0) {
      this.currentIndex.set(this.mediaList.findIndex(m => m.id === this.media.id));
      if (this.currentIndex() === -1) {
        this.currentIndex.set(0);
      }
    }
    this.loadMedia();
  }

  // ==================== MEDIA TYPE CHECKS ====================

  get isImage(): boolean {
    return this.currentMedia.isImage;
  }

  get isDocument(): boolean {
    const ext = this.currentMedia.mediaType.extension?.toLowerCase();
    return this.DOCUMENT_EXTENSIONS.includes(ext);
  }

  get isPdf(): boolean {
    return this.currentMedia.mediaType.extension?.toLowerCase() === 'pdf';
  }

  get isVideo(): boolean {
    return this.currentMedia.isVideo;
  }

  get isAudio(): boolean {
    return this.currentMedia.isAudio;
  }

  get currentMedia(): Media {
    return this.mediaList.length > 0 ? this.mediaList[this.currentIndex()] : this.media;
  }

  // ==================== NAVIGATION ====================

  canNavigatePrevious(): boolean {
    return this.mediaList.length > 1 && this.currentIndex() > 0;
  }

  canNavigateNext(): boolean {
    return this.mediaList.length > 1 && this.currentIndex() < this.mediaList.length - 1;
  }

  navigatePrevious(): void {
    if (this.canNavigatePrevious()) {
      this.currentIndex.update(i => i - 1);
      this.loadMedia();
    }
  }

  navigateNext(): void {
    if (this.canNavigateNext()) {
      this.currentIndex.update(i => i + 1);
      this.loadMedia();
    }
  }

  // ==================== MEDIA LOADING ====================

  private loadMedia(): void {
    this.isLoading.set(true);
    this.hasError.set(false);
    this.googleViewerUrl.set(null);
    this.pdfViewerUrl.set(null);
    this.isLocalPdf.set(false);

    if (this.isDocument) {
      this.loadDocument();
    } else {
      this.isLoading.set(false);
    }
  }

  private loadDocument(): void {
    const mediaUrl = this.currentMedia.imageUrl || '';

    if (this.isPdf && this.isLocalUrl(mediaUrl)) {
      // For local PDFs, use direct path
      this.isLocalPdf.set(true);
      this.pdfViewerUrl.set(this.sanitizer.bypassSecurityTrustResourceUrl(mediaUrl));
      this.isLoading.set(false);
    } else {
      // Use Google Docs Viewer for remote files and Office documents
      try {
        const encodedUrl = encodeURIComponent(mediaUrl);
        const viewerUrl = `https://docs.google.com/gview?url=${encodedUrl}&embedded=true`;
        this.googleViewerUrl.set(this.sanitizer.bypassSecurityTrustResourceUrl(viewerUrl));
        this.isLoading.set(false);
      } catch (error) {
        console.error('Failed to load document:', error);
        this.hasError.set(true);
        this.isLoading.set(false);
      }
    }
  }

  private isLocalUrl(url: string): boolean {
    return url.startsWith('http://localhost') ||
           url.startsWith('http://127.0.0.1') ||
           url.startsWith('/assets/') ||
           url.startsWith('./assets/');
  }

  onImageLoad(): void {
    this.isLoading.set(false);
  }

  onImageError(): void {
    this.hasError.set(true);
    this.isLoading.set(false);
  }

  onVideoLoad(): void {
    this.isLoading.set(false);
  }

  onVideoError(): void {
    this.hasError.set(true);
    this.isLoading.set(false);
  }

  // ==================== ACTIONS ====================

  download(): void {
    if (this.isImage) {
      this.mediaService.downloadImage(
        this.currentMedia.imageUrl || '',
        this.currentMedia.name
      );
    } else {
      this.mediaService.downloadPDF(this.currentMedia);
    }
  }

  close(): void {
    if (this.modalRef) {
      this.modalRef.close();
    }
  }

  async openEditor(): Promise<void> {
    const imageUrl = this.currentMedia.imageUrl;
    if (!imageUrl) return;

    const ref = this.modalSvc.open<ImageEditorModalComponent, ImageEditorModalData, Blob | undefined>(
      ImageEditorModalComponent,
      {
        size: 'fullscreen',
        closeable: false,
        data: {
          imageUrl,
          fileName: this.currentMedia.name,
        },
      },
    );

    const blob = await ref.afterClosed();
    if (blob) {
      // Upload the edited image as a new file
      const file = new File([blob], `edited-${this.currentMedia.name}`, { type: 'image/png' });
      try {
        await this.mediaService.uploadFile(file);
      } catch (err) {
        console.error('Failed to upload edited image:', err);
      }
    }
  }

  // ==================== KEYBOARD NAVIGATION ====================

  onKeyDown(event: KeyboardEvent): void {
    switch (event.key) {
      case 'ArrowLeft':
        this.navigatePrevious();
        break;
      case 'ArrowRight':
        this.navigateNext();
        break;
      case 'Escape':
        this.close();
        break;
    }
  }
}
