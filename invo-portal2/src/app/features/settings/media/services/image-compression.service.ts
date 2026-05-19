import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

/**
 * Enhanced Image Compression Service
 * Supports configurable compression with quality control
 */

export interface CompressionConfig {
  maxFileSizeBytes?: number;
  maxWidthPixels?: number;
  maxHeightPixels?: number;
  qualityRatio?: number;
  outputFormat?: string;
}

const DEFAULT_CONFIG: CompressionConfig = {
  maxFileSizeBytes: 1 * 1024 * 1024, // 1MB
  maxWidthPixels: 1920,
  maxHeightPixels: 1920,
  qualityRatio: 0.8,
  outputFormat: 'image/jpeg'
};

@Injectable({
  providedIn: 'root'
})
export class ImageCompressionService {
  
  /**
   * Compress an image file with configurable settings
   */
  compress(file: File, config: CompressionConfig = {}): Observable<File> {
    const finalConfig = { ...DEFAULT_CONFIG, ...config };
    const imageType = this.determineImageType(file, finalConfig.outputFormat);
    
    return new Observable(observer => {
      // Check if compression is needed
      if (!this.needsCompression(file, finalConfig)) {
        observer.next(file);
        observer.complete();
        return;
      }

      const reader = new FileReader();
      reader.readAsDataURL(file);

      reader.onload = (ev: ProgressEvent<FileReader>) => {
        const img = this.createImage(ev);
        
        img.onload = () => {
          try {
            const compressedFile = this.compressImage(img, file, imageType, finalConfig);
            observer.next(compressedFile);
            observer.complete();
          } catch (error) {
            observer.error(error);
          }
        };

        img.onerror = (error) => {
          observer.error(new Error('Failed to load image'));
        };
      };

      reader.onerror = (error) => {
        observer.error(new Error('Failed to read file'));
      };
    });
  }

  /**
   * Compress multiple images in parallel
   */
  compressBatch(files: File[], config: CompressionConfig = {}): Observable<File[]> {
    return new Observable(observer => {
      const results: File[] = [];
      let completed = 0;
      let hasError = false;

      if (files.length === 0) {
        observer.next([]);
        observer.complete();
        return;
      }

      files.forEach((file, index) => {
        this.compress(file, config).subscribe({
          next: (compressedFile) => {
            if (!hasError) {
              results[index] = compressedFile;
              completed++;
              
              if (completed === files.length) {
                observer.next(results);
                observer.complete();
              }
            }
          },
          error: (error) => {
            if (!hasError) {
              hasError = true;
              observer.error(error);
            }
          }
        });
      });
    });
  }

  /**
   * Check if file needs compression
   */
  private needsCompression(file: File, config: CompressionConfig): boolean {
    // Always compress if file is larger than max size
    if (config.maxFileSizeBytes && file.size > config.maxFileSizeBytes) {
      return true;
    }

    // For images, we'll check dimensions during load
    return true;
  }

  /**
   * Determine the appropriate image type
   */
  private determineImageType(file: File, outputFormat?: string): string {
    if (outputFormat) {
      return outputFormat;
    }

    // Preserve PNG for images with transparency
    if (file.type === 'image/png') {
      return 'image/png';
    }

    // Convert HEIC/HEIF to JPEG
    if (file.type === 'image/heic' || file.type === 'image/heif') {
      return 'image/jpeg';
    }

    // Default to JPEG for compression
    return file.type || 'image/jpeg';
  }

  /**
   * Create HTML image element from file reader event
   */
  private createImage(ev: ProgressEvent<FileReader>): HTMLImageElement {
    const img = new Image();
    img.src = ev.target?.result as string;
    return img;
  }

  /**
   * Compress the image using canvas
   */
  private compressImage(
    img: HTMLImageElement,
    originalFile: File,
    imageType: string,
    config: CompressionConfig
  ): File {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    if (!ctx) {
      throw new Error('Failed to get canvas context');
    }

    // Calculate new dimensions
    const { width, height } = this.calculateDimensions(
      img.width,
      img.height,
      config.maxWidthPixels!,
      config.maxHeightPixels!
    );

    canvas.width = width;
    canvas.height = height;

    // Draw compressed image
    ctx.drawImage(img, 0, 0, width, height);

    // Calculate quality ratio
    const qualityRatio = this.calculateQualityRatio(
      originalFile.size,
      config.maxFileSizeBytes!,
      config.qualityRatio!
    );

    // Convert to blob
    const dataUrl = canvas.toDataURL(imageType, qualityRatio);
    const blob = this.dataURLToBlob(dataUrl);

    // Create new file
    return new File([blob], originalFile.name, {
      type: imageType,
      lastModified: Date.now()
    });
  }

  /**
   * Calculate new dimensions maintaining aspect ratio
   */
  private calculateDimensions(
    originalWidth: number,
    originalHeight: number,
    maxWidth: number,
    maxHeight: number
  ): { width: number; height: number } {
    let width = originalWidth;
    let height = originalHeight;

    // Check if resizing is needed
    if (width <= maxWidth && height <= maxHeight) {
      return { width, height };
    }

    const aspectRatio = width / height;

    if (width > maxWidth) {
      width = maxWidth;
      height = width / aspectRatio;
    }

    if (height > maxHeight) {
      height = maxHeight;
      width = height * aspectRatio;
    }

    return {
      width: Math.round(width),
      height: Math.round(height)
    };
  }

  /**
   * Calculate optimal quality ratio based on file size
   */
  private calculateQualityRatio(
    fileSize: number,
    maxSize: number,
    defaultQuality: number
  ): number {
    if (fileSize <= maxSize) {
      return Math.min(1, defaultQuality);
    }

    // Calculate compression ratio needed
    const ratio = maxSize / fileSize;
    return Math.max(0.3, Math.min(ratio, defaultQuality));
  }

  /**
   * Convert data URL to Blob
   */
  private dataURLToBlob(dataURL: string): Blob {
    const parts = dataURL.split(',');
    const byteString = atob(parts[1]);
    const mimeString = parts[0].split(':')[1].split(';')[0];

    const ab = new ArrayBuffer(byteString.length);
    const ia = new Uint8Array(ab);

    for (let i = 0; i < byteString.length; i++) {
      ia[i] = byteString.charCodeAt(i);
    }

    return new Blob([ab], { type: mimeString });
  }

  /**
   * Get image dimensions without loading full image
   */
  getImageDimensions(file: File): Promise<{ width: number; height: number }> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const url = URL.createObjectURL(file);

      img.onload = () => {
        URL.revokeObjectURL(url);
        resolve({ width: img.width, height: img.height });
      };

      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error('Failed to load image'));
      };

      img.src = url;
    });
  }

  /**
   * Check if file is an image
   */
  isImageFile(file: File): boolean {
    return file.type.startsWith('image/');
  }

  /**
   * Get estimated compressed size (rough estimation)
   */
  async estimateCompressedSize(file: File, config: CompressionConfig = {}): Promise<number> {
    const finalConfig = { ...DEFAULT_CONFIG, ...config };
    
    if (file.size <= finalConfig.maxFileSizeBytes!) {
      return file.size;
    }

    const ratio = finalConfig.qualityRatio || 0.8;
    return Math.round(file.size * ratio);
  }
}
