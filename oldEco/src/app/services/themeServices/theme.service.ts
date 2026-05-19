import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { map, Observable } from 'rxjs';
import { AppConfigService } from '../app-config.service';
import { Product } from '../../models/product.model';
import { Collection } from '../../models/collection.model';
import { AppServices } from '../appServices';

@Injectable({
  providedIn: 'root',
})
export class ThemeService {
  constructor(
    private http: HttpClient,
    private config: AppConfigService,
    private appService: AppServices
  ) { }

  getCollectionProductList(params: any): Observable<any[]> {
    return this.http
      .post<{
        success: boolean;
        data: {
          list: any[];
          count: Number;
          pageCount: number;
          startIndex: number;
          lastIndex: number;
          sessionId:any;
        };
      }>(`${this.config.baseUrl}theme/getMenuProducts`, params, {
        headers: this.appService.getHeaders(),
      })
      .pipe(
        map((response) =>
          response.success
            ? [
              response.data.list.map((item) => { const _inst = new Product(); _inst.ParseJson(item); return _inst; }),
              response.data.count,
              response.data.pageCount,
              response.data.startIndex,
              response.data.lastIndex,
            ]
            : []
        )
      );
  }

  getHomeCollections(): Observable<Collection[]> {
    return this.http
      .get<{ success: boolean; data: any[] }>(
        `${this.config.baseUrl}theme/getHomeSections`,
        { headers: this.appService.getHeaders() }
      )
      .pipe(
        map((response) =>
          response.success
            ? response.data.map((item) => { const _inst = new Collection(); _inst.ParseJson(item); return _inst; })
            : []
        )
      );
  }

  getSectionData(body: any): Observable<any> {
    const url = `${this.config.baseUrl}theme/getSectionData`;
    return this.http
      .post<any>(url, body, {
        headers: this.appService.getHeaders(),
      })
      .pipe(
        map((response) => {
          return response.data;
        })
      );
  }

  getImageDimensions(url: string): Promise<{ width: number; height: number }> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        resolve({ width: img.width, height: img.height });
      };
      img.onerror = (error) => {
        reject(`Error loading image: ${error}`);
      };
      img.src = url;
    });
  }

  /**
  * Extract dominant color from an image URL
  * @param imageUrl - URL of the image
  * @param quality - Sampling quality (1-10, lower = better quality but slower)
  * @returns Promise<string> - Returns hex color string
  */
  async extractDominantColor(imageUrl: string, quality: number = 5): Promise<string> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous'; // Enable CORS

      img.onload = () => {
        try {
          const color = this.getColorFromImage(img, quality);
          resolve(color);
        } catch (error) {
          reject(error);
        }
      };

      img.onerror = () => {
        reject(new Error('Failed to load image'));
      };

      img.src = imageUrl;
    });
  }

  /**
   * Extract color palette from image
   * @param imageUrl - URL of the image
   * @param colorCount - Number of colors to extract
   * @returns Promise<string[]> - Returns array of hex color strings
   */
  async extractColorPalette(imageUrl: string, colorCount: number = 5): Promise<string[]> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';

      img.onload = () => {
        try {
          const colors = this.getColorPalette(img, colorCount);
          resolve(colors);
        } catch (error) {
          reject(error);
        }
      };

      img.onerror = () => {
        reject(new Error('Failed to load image'));
      };

      img.src = imageUrl;
    });
  }

  private getColorFromImage(img: HTMLImageElement, quality: number): string {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    if (!ctx) {
      throw new Error('Could not get canvas context');
    }

    // Resize canvas for better performance
    const scaleFactor = 0.25;
    canvas.width = img.width * scaleFactor;
    canvas.height = img.height * scaleFactor;

    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;

    const colorCounts: { [key: string]: number } = {};

    // Sample pixels based on quality
    for (let i = 0; i < data.length; i += 4 * quality) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const alpha = data[i + 3];

      // Skip transparent pixels
      if (alpha < 125) continue;

      // Skip very light or very dark colors
      const brightness = (r + g + b) / 3;
      if (brightness > 240 || brightness < 15) continue;

      const color = this.rgbToHex(r, g, b);
      colorCounts[color] = (colorCounts[color] || 0) + 1;
    }

    // Find most frequent color
    let dominantColor = '#8c8c8d'; // fallback
    let maxCount = 0;

    for (const [color, count] of Object.entries(colorCounts)) {
      if (count > maxCount) {
        maxCount = count;
        dominantColor = color;
      }
    }

    return dominantColor;
  }

  private getColorPalette(img: HTMLImageElement, colorCount: number): string[] {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    if (!ctx) {
      throw new Error('Could not get canvas context');
    }

    const scaleFactor = 0.25;
    canvas.width = img.width * scaleFactor;
    canvas.height = img.height * scaleFactor;

    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;

    const colorCounts: { [key: string]: number } = {};

    for (let i = 0; i < data.length; i += 4 * 5) { // Quality = 5
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const alpha = data[i + 3];

      if (alpha < 125) continue;

      const brightness = (r + g + b) / 3;
      if (brightness > 240 || brightness < 15) continue;

      const color = this.rgbToHex(r, g, b);
      colorCounts[color] = (colorCounts[color] || 0) + 1;
    }

    // Sort colors by frequency and return top colors
    const sortedColors = Object.entries(colorCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, colorCount)
      .map(([color]) => color);

    return sortedColors.length > 0 ? sortedColors : ['#8c8c8d'];
  }

  private rgbToHex(r: number, g: number, b: number): string {
    return "#" + [r, g, b].map(x => {
      const hex = x.toString(16);
      return hex.length === 1 ? "0" + hex : hex;
    }).join("");
  }

  /**
   * Adjust color brightness for better contrast
   * @param color - Hex color string
   * @param percent - Brightness adjustment (-100 to 100)
   * @returns string - Adjusted hex color
   */
  adjustBrightness(color: string, percent: number): string {
    const hex = color.replace('#', '');
    const r = parseInt(hex.substr(0, 2), 16);
    const g = parseInt(hex.substr(2, 2), 16);
    const b = parseInt(hex.substr(4, 2), 16);

    const adjustedR = Math.max(0, Math.min(255, r + (r * percent / 100)));
    const adjustedG = Math.max(0, Math.min(255, g + (g * percent / 100)));
    const adjustedB = Math.max(0, Math.min(255, b + (b * percent / 100)));

    return this.rgbToHex(
      Math.round(adjustedR),
      Math.round(adjustedG),
      Math.round(adjustedB)
    );
  }
}
