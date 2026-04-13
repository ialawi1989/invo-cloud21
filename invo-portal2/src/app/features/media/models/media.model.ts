/**
 * Media Models
 * Enhanced TypeScript models for media management
 * Supports images, documents, videos, and various file types
 */

export interface IMediaType {
  fileType: string;
  extension: string;
}

export interface IMediaSize {
  size: number;
  formatted?: string;
}

export interface IMediaUrl {
  defaultUrl?: string;
  original?: string;    // alias — some code uses this
  thumbnail?: string;
  medium?: string;
  large?: string;
}

export interface IMediaUploadProgress {
  loaded: number;
  total: number;
  percentage: number;
}

export interface IMedia {
  id: string | null;
  name: string;
  media: string | Blob | null; // Base64 string or Blob
  size: IMediaSize;
  mediaType: IMediaType;
  contentType: string; // docs, image, video, audio, model
  mediaTypeStr: string;
  mediaTypeCode: string;
  mediaSize: number | null;
  isAttached: boolean;
  createdDate: Date;
  updatedDate: Date;
  uploadTo: string[];
  url: IMediaUrl;
  isSelected: boolean;
  uploadProgress?: IMediaUploadProgress;
  uploadStatus?: 'pending' | 'uploading' | 'completed' | 'failed' | 'cancelled';
  uploadError?: string;
}

export class Media implements IMedia {
  id: string | null = null;
  name: string = '';
  media: string | Blob | null = null;
  size: IMediaSize = { size: 0 };
  mediaType: IMediaType = { fileType: '', extension: '' };
  contentType: string = '';
  mediaTypeStr: string = '';
  mediaTypeCode: string = '';
  mediaSize: number | null = null;
  isAttached: boolean = false;
  createdDate: Date = new Date();
  updatedDate: Date = new Date();
  uploadTo: string[] = [];
  url: IMediaUrl = {};
  isSelected: boolean = false;
  uploadProgress?: IMediaUploadProgress;
  uploadStatus?: 'pending' | 'uploading' | 'completed' | 'failed' | 'cancelled' = 'pending';
  uploadError?: string;

  constructor(data?: Partial<IMedia>) {
    if (data) {
      Object.assign(this, data);
    }
  }

  get getSize(): number {
    return this.size?.size || 0;
  }

  get getFormattedSize(): string {
    const size = this.getSize;
    if (size === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(size) / Math.log(k));
    return `${parseFloat((size / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
  }

  /** Best available full-size URL (`defaultUrl` → `original` → thumbnail). */
  get imageUrl(): string {
    return this.url?.defaultUrl || this.url?.original || this.url?.thumbnail || '';
  }

  /** Thumbnail URL (falls back to full image). */
  get thumbUrl(): string {
    return this.url?.thumbnail || this.url?.defaultUrl || this.url?.original || '';
  }

  get isImage(): boolean {
    return this.mediaType?.fileType === 'image' || this.contentType === 'image';
  }

  get isDocument(): boolean {
    return this.mediaType?.fileType === 'document' || this.contentType === 'docs';
  }

  get isVideo(): boolean {
    return this.mediaType?.fileType === 'video' || this.contentType === 'video';
  }

  get isAudio(): boolean {
    return this.mediaType?.fileType === 'audio' || this.contentType === 'audio';
  }

  parseJson(json: Partial<IMedia>): void {
    Object.assign(this, json);
  }

  toJson(): IMedia {
    return {
      id: this.id,
      name: this.name,
      media: this.media,
      size: this.size,
      mediaType: this.mediaType,
      contentType: this.contentType,
      mediaTypeStr: this.mediaTypeStr,
      mediaTypeCode: this.mediaTypeCode,
      mediaSize: this.mediaSize,
      isAttached: this.isAttached,
      createdDate: this.createdDate,
      updatedDate: this.updatedDate,
      uploadTo: this.uploadTo,
      url: this.url,
      isSelected: this.isSelected,
      uploadProgress: this.uploadProgress,
      uploadStatus: this.uploadStatus,
      uploadError: this.uploadError
    };
  }
}

export interface IMediaLinkType {
  id: string | null;
  name: string;
  reference: string; // Product, Employee, etc.
  linkIsSelected: boolean;
}

export class MediaLinkType implements IMediaLinkType {
  id: string | null = null;
  name: string = '';
  reference: string = '';
  linkIsSelected: boolean = false;

  constructor(data?: Partial<IMediaLinkType>) {
    if (data) {
      Object.assign(this, data);
    }
  }
}

export interface IMediaFilter {
  contentType?: string[];
  mediaType?: string[];
  dateFrom?: Date;
  dateTo?: Date;
  searchQuery?: string;
  isAttached?: boolean;
}

export interface IMediaUploadConfig {
  maxFileSize?: number; // in bytes
  allowedTypes?: string[];
  compressionEnabled?: boolean;
  compressionQuality?: number;
  maxDimensions?: { width: number; height: number };
}

export interface IMediaUploadResult {
  success: boolean;
  data?: Media[];
  error?: string;
  message?: string;
}

export interface IAttachmentParams {
  reference: string; // e.g., 'invoice', 'product'
  referenceId: string;
  attachment: Array<{ id: string }>;
}

export interface IGetAttachmentsParams {
  reference: string;
  referenceId: string;
}

// File upload item for tracking upload progress
export interface IFileUploadItem {
  id: string;
  file: File;
  name: string;
  size: number;
  type: string;
  status: 'pending' | 'uploading' | 'completed' | 'failed' | 'cancelled';
  progress: number;
  uploadedSize: number;
  error?: string;
  media?: Media;
  startTime?: number;
  endTime?: number;
}

export class FileUploadItem implements IFileUploadItem {
  id: string;
  file: File;
  name: string;
  size: number;
  type: string;
  status: 'pending' | 'uploading' | 'completed' | 'failed' | 'cancelled' = 'pending';
  progress: number = 0;
  uploadedSize: number = 0;
  error?: string;
  media?: Media;
  startTime?: number;
  endTime?: number;

  constructor(file: File) {
    this.id = this.generateId();
    this.file = file;
    this.name = file.name;
    this.size = file.size;
    this.type = file.type;
  }

  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  get formattedSize(): string {
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(this.size) / Math.log(k));
    return `${parseFloat((this.size / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
  }

  get uploadSpeed(): string {
    if (!this.startTime || this.status !== 'uploading') return '';
    const elapsed = (Date.now() - this.startTime) / 1000;
    if (elapsed === 0) return '';
    const speed = this.uploadedSize / elapsed;
    const k = 1024;
    const sizes = ['B/s', 'KB/s', 'MB/s'];
    const i = Math.floor(Math.log(speed) / Math.log(k));
    return `${parseFloat((speed / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
  }

  get remainingTime(): string {
    if (!this.startTime || this.status !== 'uploading' || this.progress === 0) return '';
    const elapsed = (Date.now() - this.startTime) / 1000;
    const totalTime = elapsed / (this.progress / 100);
    const remaining = totalTime - elapsed;
    if (remaining < 60) return `${Math.ceil(remaining)}s`;
    return `${Math.ceil(remaining / 60)}m`;
  }
}
