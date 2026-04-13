import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, firstValueFrom } from 'rxjs';
import { environment } from '../../../../environments/environment';
import {
  Media,
  FileUploadItem,
  IMediaUploadResult,
  IAttachmentParams,
  IGetAttachmentsParams,
  IMediaUploadConfig
} from '../models/media.model';
/**
 * Media Service
 * Uses HTTP Interceptor for auth (like CmsService)
 */

@Injectable({ providedIn: 'root' })
export class MediaService {
  private http = inject(HttpClient);
  private baseUrl = environment.backendUrl;

  // Configuration
  static readonly MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB
  static readonly SUPPORTED_IMAGE_TYPES = [
    'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'
  ];
  static readonly SUPPORTED_DOCUMENT_TYPES = [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation'
  ];

  // State management
  private uploadQueue$ = new BehaviorSubject<FileUploadItem[]>([]);
  private uploadProgress$ = new BehaviorSubject<Map<string, number>>(new Map());

  public readonly uploadQueue = this.uploadQueue$.asObservable();
  public readonly uploadProgress = this.uploadProgress$.asObservable();

  // ── File Validation ───────────────────────────────────────────────────────

  validateFile(file: File, config?: IMediaUploadConfig): { valid: boolean; error?: string } {
    const maxSize = config?.maxFileSize || MediaService.MAX_FILE_SIZE;
    const allowedTypes = config?.allowedTypes || [
      ...MediaService.SUPPORTED_IMAGE_TYPES,
      ...MediaService.SUPPORTED_DOCUMENT_TYPES
    ];

    if (file.size > maxSize) {
      return {
        valid: false,
        error: `File size exceeds maximum allowed size of ${this.formatBytes(maxSize)}`
      };
    }

    if (!allowedTypes.includes(file.type)) {
      return {
        valid: false,
        error: `File type ${file.type} is not supported`
      };
    }

    return { valid: true };
  }

  validateFiles(files: File[], config?: IMediaUploadConfig): Map<string, string | null> {
    const results = new Map<string, string | null>();
    files.forEach(file => {
      const validation = this.validateFile(file, config);
      results.set(file.name, validation.valid ? null : (validation.error || 'Invalid file'));
    });
    return results;
  }

  // ── Upload ────────────────────────────────────────────────────────────────

  /** Upload a single file */
  async uploadFile(file: File, config?: IMediaUploadConfig): Promise<IMediaUploadResult> {
    const validation = this.validateFile(file, config);
    if (!validation.valid) {
      throw new Error(validation.error);
    }

    const uploadItem = new FileUploadItem(file);
    this.addToUploadQueue(uploadItem);

    try {
      const preparedFile = await this.prepareFileForUpload(file, config);
      const result = await this.executeUpload(preparedFile, uploadItem.id);

      this.updateUploadItem(uploadItem.id, { status: 'completed', progress: 100 });
      return result;
    } catch (error: any) {
      this.updateUploadItem(uploadItem.id, {
        status: 'failed',
        error: error.message || 'Upload failed'
      });
      throw error;
    }
  }

  /** Upload multiple files */
  async uploadFiles(files: File[], config?: IMediaUploadConfig): Promise<IMediaUploadResult[]> {
    const results: IMediaUploadResult[] = [];
    for (const file of files) {
      try {
        const result = await this.uploadFile(file, config);
        results.push(result);
      } catch (error: any) {
        results.push({
          success: false,
          error: error.message || 'Upload failed'
        });
      }
    }
    return results;
  }

  private async prepareFileForUpload(file: File, _config?: IMediaUploadConfig): Promise<File> {
    // No client-side compression — backend handles it.
    return file;
  }

  private async executeUpload(file: File, uploadId: string): Promise<IMediaUploadResult> {
    const extension = this.extractExtension(file.name);
    const category = this.resolveCategory(file.type, extension);

    const formData = new FormData();
    formData.append('file', file, file.name);
    formData.append('name', file.name);
    formData.append('size', file.size.toString());
    formData.append('type', file.type);
    formData.append('extension', extension);
    formData.append('category', category);
    formData.append('contentTypes', category);
    formData.append('uploadType', 'individual');
    formData.append('timestamp', new Date().toISOString());

    let response: any;
    try {
      response = await firstValueFrom(
        this.http.post<any>(`${this.baseUrl}media/importMedia`, formData)
      );
    } catch (httpError: any) {
      const status = httpError?.status || 'unknown';
      const msg = httpError?.error?.message || httpError?.message || `Server error (${status})`;
      return {
        success: false,
        error: msg,
        message: msg,
      };
    }

    if (response?.success === false) {
      return {
        success: false,
        error: response.message || 'Upload failed',
        message: response.message || 'Upload failed',
      };
    }

    // Backend may return data as a single object or an array
    let data: Media[] = [];
    if (response?.data) {
      data = Array.isArray(response.data) ? response.data.map((d: any) => new Media(d)) : [new Media(response.data)];
    }

    return {
      success: true,
      data,
      message: 'Upload completed'
    };
  }

  /** Map MIME type + extension to a content category (image, document, video, audio, model). */
  private resolveCategory(mimeType: string, extension: string): string {
    if (mimeType.startsWith('image/')) return 'image';
    if (mimeType.startsWith('video/')) return 'video';
    if (mimeType.startsWith('audio/')) return 'audio';

    const docExts = ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt', 'rtf', 'csv'];
    const modelExts = ['obj', 'fbx', 'glb', 'gltf', '3ds', 'dae', 'blend'];

    const ext = extension.toLowerCase();
    if (docExts.includes(ext)) return 'document';
    if (modelExts.includes(ext)) return 'model';
    if (mimeType.startsWith('application/')) return 'document';

    return 'other';
  }

  // ── Media Retrieval ───────────────────────────────────────────────────────

  /** Get all media with optional filters (backwards-compatible — list only) */
  async getAllMedia(filters?: any): Promise<Media[]> {
    const result = await this.getMediaListPaged(filters);
    return result.list;
  }

  /**
   * Get a paged media listing.
   * Returns the full backend response: list, total count, page info, and
   * (optionally) countByType for driving tab badges.
   */
  async getMediaListPaged(filters?: any): Promise<{
    list: Media[];
    count: number;
    pageCount: number;
    startIndex: number;
    lastIndex: number;
    countByType?: Record<string, number>;
  }> {
    const body = {
      page: 1,
      limit: 15,
      searchTerm: '',
      sortBy: {},
      contentType: [],
      ...(filters || {})
    };

    const response = await firstValueFrom(
      this.http.post<any>(`${this.baseUrl}media/getMediaList`, body)
    );

    const data = response.data || {};
    return {
      list: (data.list || []).map((item: any) => new Media(item)),
      count: data.count ?? 0,
      pageCount: data.pageCount ?? 0,
      startIndex: data.startIndex ?? 0,
      lastIndex: data.lastIndex ?? 0,
      countByType: data.countByType,
    };
  }

  /** Get media by ID */
  async getMediaById(id: string): Promise<Media> {
    const response = await firstValueFrom(
      this.http.get<any>(`${this.baseUrl}media/getMediabyId/${id}`)
    );
    return new Media(response.data);
  }

  // ── Media Deletion ────────────────────────────────────────────────────────

  /** Delete media by ID */
  async deleteMedia(id: string): Promise<boolean> {
    const response = await firstValueFrom(
      this.http.post<any>(`${this.baseUrl}media/deleteMedia`, { id })
    );
    return response.success || false;
  }

  /** Delete multiple media items */
  async deleteMultipleMedia(ids: string[]): Promise<boolean> {
    if (ids.length === 0) return true;
    const results = await Promise.all(ids.map(id => this.deleteMedia(id)));
    return results.every(r => r === true);
  }

  // ── Attachments ───────────────────────────────────────────────────────────

  /** Append attachments to a reference entity */
  async appendAttachment(params: IAttachmentParams): Promise<boolean> {
    const response = await firstValueFrom(
      this.http.post<any>(`${this.baseUrl}media/appendAttachment`, params)
    );
    return response.success || false;
  }

  /** Get attachments for a reference entity */
  async getAttachments(params: IGetAttachmentsParams): Promise<Media[]> {
    const response = await firstValueFrom(
      this.http.post<any>(`${this.baseUrl}media/getAttachments`, params)
    );
    return (response.data?.attachment || []).map((item: any) => new Media(item));
  }

  /** Delete an attachment */
  async deleteAttachment(params: { reference: string; referenceId: string; attachmentId: string }): Promise<boolean> {
    const response = await firstValueFrom(
      this.http.post<any>(`${this.baseUrl}media/deleteAttachment`, params)
    );
    return response.success || false;
  }

  /**
   * Unlink media from multiple entities (bulk detach)
   * Compatible with old project's unLinkMedia
   */
  async unLinkMedia(linkedEntities: any[]): Promise<any> {
    try {
      const response = await firstValueFrom(
        this.http.post<any>(`${this.baseUrl}media/unLinkMedia`, linkedEntities)
      );
      return response;
    } catch (error) {
      console.error('unLinkMedia error:', error);
      return { success: false, error };
    }
  }

  // ── Download ──────────────────────────────────────────────────────────────

  downloadImage(url: string, filename: string): void {
    const xhr = new XMLHttpRequest();
    xhr.open('GET', url, true);
    xhr.responseType = 'blob';
    xhr.onload = () => {
      if (xhr.status === 200) {
        this.triggerDownload(xhr.response, filename);
      }
    };
    xhr.send();
  }

  downloadPDF(media: Media): void {
    const url = media.imageUrl;
    if (!url) return;
    const xhr = new XMLHttpRequest();
    xhr.open('GET', url, true);
    xhr.responseType = 'blob';
    xhr.onload = () => {
      if (xhr.status === 200) {
        const filename = `${media.name}_${this.formatDate(new Date())}.${media.mediaType.extension}`;
        this.triggerDownload(xhr.response, filename);
      }
    };
    xhr.send();
  }

  private triggerDownload(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    URL.revokeObjectURL(url);
    document.body.removeChild(a);
  }

  // ── Upload Queue Management ───────────────────────────────────────────────

  private addToUploadQueue(item: FileUploadItem): void {
    const currentQueue = this.uploadQueue$.value;
    this.uploadQueue$.next([...currentQueue, item]);
  }

  private updateUploadItem(id: string, updates: Partial<FileUploadItem>): void {
    const currentQueue = this.uploadQueue$.value;
    const updatedQueue = currentQueue.map(item => {
      if (item.id === id) {
        const updated = new FileUploadItem(item.file);
        Object.assign(updated, item, updates);
        return updated;
      }
      return item;
    });
    this.uploadQueue$.next(updatedQueue);
  }

  clearCompletedUploads(): void {
    const currentQueue = this.uploadQueue$.value;
    const activeQueue = currentQueue.filter(item =>
      item.status !== 'completed' && item.status !== 'failed'
    );
    this.uploadQueue$.next(activeQueue);
  }

  cancelUpload(id: string): void {
    this.updateUploadItem(id, { status: 'cancelled' });
  }

  // ── Utility Methods ───────────────────────────────────────────────────────

  isImageFile(file: File): boolean {
    return MediaService.SUPPORTED_IMAGE_TYPES.includes(file.type);
  }

  isDocumentFile(file: File): boolean {
    return MediaService.SUPPORTED_DOCUMENT_TYPES.includes(file.type);
  }

  formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
  }

  private formatDate(date: Date): string {
    return `${date.getFullYear()}_${date.getMonth() + 1}_${date.getDate()}`;
  }

  extractExtension(filename: string): string {
    const dotIndex = filename.lastIndexOf('.');
    return dotIndex !== -1 ? filename.slice(dotIndex + 1) : '';
  }

  getMimeTypeFromExtension(extension: string): string {
    const mimeTypes: Record<string, string> = {
      'jpg': 'image/jpeg',
      'jpeg': 'image/jpeg',
      'png': 'image/png',
      'gif': 'image/gif',
      'webp': 'image/webp',
      'pdf': 'application/pdf',
      'doc': 'application/msword',
      'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'xls': 'application/vnd.ms-excel',
      'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'ppt': 'application/vnd.ms-powerpoint',
      'pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
    };
    return mimeTypes[extension.toLowerCase()] || 'application/octet-stream';
  }
}
