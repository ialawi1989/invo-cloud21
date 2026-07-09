import { Component, Input, OnInit, OnDestroy, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';

import { Media } from '../../models/media.model';
import { MediaService } from '../../services/media.service';
import { MODAL_REF, MODAL_DATA } from '../../../../../shared/modal/modal.tokens';
import { ModalRef, ModalService } from '../../../../../shared/modal/modal.service';
import { ImageEditorModalComponent, ImageEditorModalData } from '../../../../../shared/components/image-editor';

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
export class MediaPreviewComponent implements OnInit, OnDestroy {
  @Input() media!: Media;
  @Input() mediaList: Media[] = [];
  @Input() title = 'Media Preview';

  // Inject modal system with proper typing
  private modalRef = inject<ModalRef | null>(MODAL_REF, { optional: true });
  private modalData = inject<PreviewModalData | null>(MODAL_DATA, { optional: true });

  // State
  currentIndex = signal(0);
  /** Same-origin blob: URL for the browser's built-in PDF viewer. */
  pdfViewerUrl = signal<SafeResourceUrl | null>(null);
  /** Decoded contents for plain-text style documents. */
  docTextContent = signal<string | null>(null);
  /** True when the file is a document we can't render inline (Office/binary). */
  previewUnavailable = signal(false);
  isLoading = signal(true);
  hasError = signal(false);

  /** Resolved <img> source for the current image (a blob: URL when fetched
   *  through the authenticated raw endpoint, else the direct CDN URL). */
  imageSrc = signal<string>('');
  /** Object URL backing `imageSrc`, revoked when it changes or on destroy. */
  private currentObjectUrl: string | null = null;
  /** Object URL backing the PDF iframe, revoked when it changes or on destroy. */
  private docObjectUrl: string | null = null;

  // Extensions we render inline natively (no third-party viewer).
  private readonly PDF_EXTENSIONS = ['pdf'];
  private readonly TEXT_EXTENSIONS = [
    'txt', 'csv', 'json', 'md', 'markdown', 'xml', 'html', 'htm',
    'log', 'yml', 'yaml', 'js', 'ts', 'css', 'svg', 'ics',
  ];
  // File types routed through the document viewer (superset of the above plus
  // Office formats, which fall back to a download card).
  private readonly DOCUMENT_EXTENSIONS = [
    'pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', ...this.TEXT_EXTENSIONS,
  ];

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
    return this.DOCUMENT_EXTENSIONS.includes(ext) || this.currentMedia.isDocument;
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
    this.pdfViewerUrl.set(null);
    this.docTextContent.set(null);
    this.previewUnavailable.set(false);

    if (this.isDocument) {
      this.loadDocument();
    } else if (this.isImage) {
      this.loadImagePreview();
    } else {
      // Video / audio stream straight from the URL — no need to buffer bytes.
      this.revokeObjectUrl();
      this.isLoading.set(false);
    }
  }

  /**
   * Load the image through the authenticated raw endpoint so the preview
   * matches what the editor edits and doesn't depend on the CDN's S3 redirect.
   * Falls back to the direct URL if the fetch fails.
   */
  private async loadImagePreview(): Promise<void> {
    this.revokeObjectUrl();
    const mediaId = this.currentMedia.id;
    const directUrl =
      this.currentMedia.imageUrl || this.currentMedia.url.large || this.currentMedia.url.medium || '';

    if (!mediaId) {
      this.imageSrc.set(directUrl);
      this.isLoading.set(false);
      return;
    }

    // Remember which item we're loading so a slow fetch that resolves after the
    // user has navigated away doesn't clobber the newer image.
    const requestedId = mediaId;
    try {
      const blob = await this.mediaService.getMediaRawBlob(requestedId);
      if (this.currentMedia.id !== requestedId) return; // navigated away
      this.currentObjectUrl = URL.createObjectURL(blob);
      this.imageSrc.set(this.currentObjectUrl);
    } catch (err) {
      console.error('Failed to load image via raw endpoint; using direct URL:', err);
      if (this.currentMedia.id !== requestedId) return;
      this.imageSrc.set(directUrl);
    } finally {
      if (this.currentMedia.id === requestedId) this.isLoading.set(false);
    }
  }

  private revokeObjectUrl(): void {
    if (this.currentObjectUrl) {
      URL.revokeObjectURL(this.currentObjectUrl);
      this.currentObjectUrl = null;
    }
  }

  private revokeDocObjectUrl(): void {
    if (this.docObjectUrl) {
      URL.revokeObjectURL(this.docObjectUrl);
      this.docObjectUrl = null;
    }
  }

  ngOnDestroy(): void {
    this.revokeObjectUrl();
    this.revokeDocObjectUrl();
  }

  /**
   * Render documents natively, without any third-party viewer.
   *
   * The bytes are fetched through the authenticated raw endpoint (the same path
   * images use) so the request carries our auth + CORS headers. This is exactly
   * why the old Google Docs Viewer failed with a 400: Google fetched the CDN URL
   * anonymously and couldn't read the protected/signed file.
   *
   *  - PDF  → same-origin blob: URL in an <iframe>, using the browser's built-in
   *           PDF viewer.
   *  - text → decoded and shown in a <pre>.
   *  - other (Office/binary) → a download card; browsers can't render these
   *           inline and every "office viewer" service is a third party.
   */
  private async loadDocument(): Promise<void> {
    this.revokeDocObjectUrl();

    const ext = this.currentMedia.mediaType.extension?.toLowerCase() ?? '';
    const requestedId = this.currentMedia.id;
    const directUrl = this.currentMedia.imageUrl || '';

    try {
      const blob = await this.fetchDocumentBlob(requestedId, directUrl);
      if (this.currentMedia.id !== requestedId) return; // navigated away

      const isPdf = this.PDF_EXTENSIONS.includes(ext) || blob.type === 'application/pdf';
      const isText = this.TEXT_EXTENSIONS.includes(ext) || blob.type.startsWith('text/');

      if (isPdf) {
        // Force the PDF content-type so the browser opens its viewer even if the
        // endpoint returned a generic octet-stream.
        this.docObjectUrl = URL.createObjectURL(
          new Blob([blob], { type: 'application/pdf' }),
        );
        this.pdfViewerUrl.set(this.sanitizer.bypassSecurityTrustResourceUrl(this.docObjectUrl));
      } else if (isText) {
        const text = await blob.text();
        if (this.currentMedia.id !== requestedId) return;
        this.docTextContent.set(text);
      } else {
        this.previewUnavailable.set(true);
      }
    } catch (error) {
      console.error('Failed to load document:', error);
      if (this.currentMedia.id !== requestedId) return;
      this.hasError.set(true);
    } finally {
      if (this.currentMedia.id === requestedId) this.isLoading.set(false);
    }
  }

  /** Fetch the document bytes: via the authenticated raw endpoint when we have
   *  an id, otherwise a plain fetch of the direct URL (local assets, etc.). */
  private async fetchDocumentBlob(id: string | null, directUrl: string): Promise<Blob> {
    if (id) {
      return this.mediaService.getMediaRawBlob(id);
    }
    if (!directUrl) throw new Error('No document source available');
    const res = await fetch(directUrl);
    if (!res.ok) throw new Error(`Failed to fetch document (HTTP ${res.status})`);
    return res.blob();
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

  async download(): Promise<void> {
    if (this.isImage) {
      const mediaId = this.currentMedia.id;
      if (mediaId) {
        try {
          await this.mediaService.downloadMediaRaw(mediaId, this.currentMedia.name);
          return;
        } catch (err) {
          console.error('Raw image download failed; using direct URL:', err);
        }
      }
      this.mediaService.downloadImage(this.currentMedia.imageUrl || '', this.currentMedia.name);
    } else {
      // Prefer the authenticated raw endpoint so protected files download too;
      // fall back to the direct CDN URL if it fails.
      const mediaId = this.currentMedia.id;
      if (mediaId) {
        try {
          await this.mediaService.downloadMediaRaw(mediaId, this.currentMedia.name);
          return;
        } catch (err) {
          console.error('Raw document download failed; using direct URL:', err);
        }
      }
      this.mediaService.downloadPDF(this.currentMedia);
    }
  }

  close(): void {
    if (this.modalRef) {
      this.modalRef.close();
    }
  }

  async openEditor(): Promise<void> {
    const mediaId = this.currentMedia.id;
    const fallbackUrl = this.currentMedia.imageUrl;
    if (!mediaId && !fallbackUrl) return;

    // Prefer the authenticated raw endpoint: it streams the bytes through our
    // backend (with CORS + auth) so the canvas stays untainted and Save works.
    // A same-origin blob: URL is what the editor loads. Fall back to the CDN
    // URL if the fetch fails (editing still works; export may be blocked).
    let editorUrl = fallbackUrl;
    let objectUrl: string | null = null; // only set when *we* create one here
    if (this.currentObjectUrl) {
      // Reuse the blob the preview already fetched — no second round-trip.
      editorUrl = this.currentObjectUrl;
    } else if (mediaId) {
      try {
        const rawBlob = await this.mediaService.getMediaRawBlob(mediaId);
        objectUrl = URL.createObjectURL(rawBlob);
        editorUrl = objectUrl;
      } catch (err) {
        console.error('Failed to fetch image for editing; using direct URL:', err);
      }
    }

    const ref = this.modalSvc.open<ImageEditorModalComponent, ImageEditorModalData, Blob | undefined>(
      ImageEditorModalComponent,
      {
        size: 'fullscreen',
        closeable: false,
        data: {
          imageUrl: editorUrl,
          fileName: this.currentMedia.name,
        },
      },
    );

    let editedBlob: Blob | undefined;
    try {
      editedBlob = await ref.afterClosed();
    } finally {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    }

    if (editedBlob) {
      // Build the upload File from the edited bytes. The editor exports WebP (or
      // JPEG as a fallback), so derive the name/extension from the blob's actual
      // type — the backend derives the stored extension and content-type from
      // the uploaded file name, so it must match the bytes (never name.png +
      // WebP).
      const type = editedBlob.type || 'image/webp';
      const ext = type === 'image/jpeg' ? 'jpg' : type === 'image/png' ? 'png' : 'webp';
      const baseName = this.currentMedia.name.replace(/\.[^.]+$/, '');
      const file = new File([editedBlob], `edited-${baseName}.${ext}`, { type });

      // Close the preview and hand the file to the opener, which uploads it with
      // a page-level spinner and refreshes the library. Uploading here would be
      // torn down the moment the modal closes, so the opener owns it.
      this.modalRef?.close(file);
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
