import { Component, Input, ViewChild, ElementRef, AfterViewInit, OnChanges, SimpleChanges, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { CustomizerService } from '../../services/customizer.service';
import { DeviceType, DEVICE_WIDTHS } from '../../models/settings.model';
import { environment } from '../../../../../environments/environment.prod';

@Component({
  selector: 'app-preview-frame',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="preview-container">
      <div class="preview-wrapper" [style.width]="getPreviewWidth()">
        <div class="preview-header">
          <div class="browser-dots">
            <span class="dot red"></span>
            <span class="dot yellow"></span>
            <span class="dot green"></span>
          </div>
          <div class="url-bar">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
              <path d="M7 11V7a5 5 0 0110 0v4"/>
            </svg>
            <span>{{ previewUrl }}</span>
          </div>
          <button class="refresh-btn" (click)="refreshPreview()" title="Refresh">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="23,4 23,10 17,10"/>
              <path d="M20.49 15a9 9 0 11-2.12-9.36L23 10"/>
            </svg>
          </button>
        </div>
        <div class="iframe-container">
          <iframe 
            #previewFrame
            [src]="safePreviewUrl"
            (load)="onIframeLoad()"
            title="Website Preview">
          </iframe>
          @if (!isLoaded) {
            <div class="loading-overlay">
              <div class="spinner"></div>
              <p>Loading preview...</p>
              <p class="loading-hint">Make sure the website is running on port 4300</p>
            </div>
          }
        </div>
      </div>
    </div>
  `,
  styles: [`
    .preview-container {
      height: 100%;
      padding: 24px;
      display: flex;
      justify-content: center;
      align-items: flex-start;
      overflow: auto;
    }
    
    .preview-wrapper {
      background: #1a1a2e;
      border-radius: 12px;
      overflow: hidden;
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
      transition: width 0.3s ease;
      max-width: 100%;
    }
    
    .preview-header {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 12px 16px;
      background: #252536;
      border-bottom: 1px solid var(--border-color);
    }
    
    .browser-dots {
      display: flex;
      gap: 6px;
    }
    
    .dot {
      width: 12px;
      height: 12px;
      border-radius: 50%;
    }
    
    .dot.red { background: #ff5f57; }
    .dot.yellow { background: #febc2e; }
    .dot.green { background: #28c840; }
    
    .url-bar {
      flex: 1;
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 6px 12px;
      background: var(--bg-input);
      border-radius: 6px;
      font-size: 12px;
      color: var(--text-secondary);
    }
    
    .url-bar svg {
      color: var(--success-color);
      flex-shrink: 0;
    }
    
    .url-bar span {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    
    .refresh-btn {
      padding: 6px;
      background: transparent;
      border: none;
      color: var(--text-secondary);
      cursor: pointer;
      border-radius: 4px;
      transition: all 0.2s;
    }
    
    .refresh-btn:hover {
      background: var(--bg-input);
      color: var(--text-primary);
    }
    
    .iframe-container {
      position: relative;
      height: calc(100vh - 180px);
      min-height: 400px;
    }
    
    iframe {
      width: 100%;
      height: 100%;
      border: none;
      background: white;
    }
    
    .loading-overlay {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      background: var(--bg-dark);
      gap: 16px;
    }
    
    .spinner {
      width: 40px;
      height: 40px;
      border: 3px solid var(--border-color);
      border-top-color: var(--primary-color);
      border-radius: 50%;
      animation: spin 1s linear infinite;
    }
    
    @keyframes spin {
      to { transform: rotate(360deg); }
    }
    
    .loading-overlay p {
      color: var(--text-secondary);
      font-size: 14px;
    }
    
    .loading-hint {
      font-size: 12px !important;
      opacity: 0.6;
      margin-top: 8px;
    }
  `]
})
export class PreviewFrameComponent implements OnInit, AfterViewInit, OnChanges {
  @ViewChild('previewFrame') previewFrame!: ElementRef<HTMLIFrameElement>;
  @Input() device: DeviceType = 'desktop';
  
  previewUrl = environment.websiteUrl;
  safePreviewUrl!: SafeResourceUrl;
  isLoaded = false;
  
  constructor(
    private customizer: CustomizerService,
    private sanitizer: DomSanitizer
  ) {}
  
  ngOnInit(): void {
    this.safePreviewUrl = this.sanitizer.bypassSecurityTrustResourceUrl(
      this.previewUrl + '?customize=true'
    );
  }
  
  ngAfterViewInit(): void {
    setTimeout(() => {
      if (this.previewFrame?.nativeElement) {
        this.customizer.registerIframe(this.previewFrame.nativeElement);
      }
    }, 100);
  }
  
  ngOnChanges(changes: SimpleChanges): void {
    if (changes['device'] && this.previewFrame?.nativeElement) {
      // Trigger resize event in iframe if needed
    }
  }
  
  onIframeLoad(): void {
    this.isLoaded = true;
    if (this.previewFrame?.nativeElement) {
      this.customizer.registerIframe(this.previewFrame.nativeElement);
    }
  }
  
  refreshPreview(): void {
    this.isLoaded = false;
    this.safePreviewUrl = this.sanitizer.bypassSecurityTrustResourceUrl(
      this.previewUrl + '?customize=true&t=' + Date.now()
    );
  }
  
  getPreviewWidth(): string {
    const width = DEVICE_WIDTHS[this.device];
    if (width === 100) {
      return '100%';
    }
    return `${width}px`;
  }
}
