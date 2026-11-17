import {
  ChangeDetectionStrategy, Component, computed, CUSTOM_ELEMENTS_SCHEMA, OnDestroy, effect, inject, input, signal, untracked,
} from '@angular/core';
import { CommonModule } from '@angular/common';

import { usdzToGlb } from './usdz-to-glb';
import { MediaService } from '../../services/media.service';

/**
 * A 3D model viewer (GLB / GLTF): drag to rotate, wheel / pinch to zoom, and an AR button on phones that support it.
 * USDZ files are converted to GLB in the browser for display only (see `usdz-to-glb.ts`); if that fails, Apple's AR is offered.
 * It wraps Google's `<model-viewer>` web component, which is loaded on first use (its own lazy chunk) so pages without a
 * model never download it.
 *
 * Give it the media id: the bytes are read through the authenticated backend (the same-origin route the Photo Editor uses),
 * because the storage address has no CORS headers and the viewer could not fetch the file from it. A plain `src` (a `blob:`
 * or same-origin URL) works too.
 */
@Component({
  selector: 'app-model-viewer',
  standalone: true,
  imports: [CommonModule],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="mv" [style.height]="height()">
      @if (isUsdz() && usdzFailed()) {
        <div class="mv__overlay mv__overlay--info">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/>
            <path d="m3.3 7 8.7 5 8.7-5M12 22V12"/>
          </svg>
          <p>This USDZ file can't be drawn in the page, but iPhone and iPad open it in AR.</p>
          @if (arUrl(); as u) {
            <a class="mv__ar" rel="ar" [attr.href]="u" [attr.download]="name() + '.usdz'">
              <img width="1" height="1" alt="" src="data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw=="/>
              Open in AR
            </a>
          }
        </div>
      } @else if (url(); as u) {
        <model-viewer
          [attr.src]="u"
          [attr.alt]="name()"
          [attr.ios-src]="isUsdz() ? arUrl() : null"
          camera-controls
          auto-rotate
          shadow-intensity="1"
          touch-action="pan-y"
          ar
          (load)="state.set('ready')"
          (error)="state.set('error')">
        </model-viewer>
      }
      @if (isUsdz() && usdzFailed()) {
      } @else if (state() === 'loading') {
        <div class="mv__overlay"><span class="mv__spin"></span><span>Loading 3D model…</span></div>
      } @else if (state() === 'error') {
        <div class="mv__overlay mv__overlay--error">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/>
            <path d="m3.3 7 8.7 5 8.7-5M12 22V12"/>
          </svg>
          <p>This 3D model could not be shown. The viewer reads GLB and GLTF files; check that the file opens, or download it.</p>
        </div>
      }
    </div>
  `,
  styles: [`
    :host { display: block; width: 100%; }
    .mv { position: relative; width: 100%; min-height: 220px; border-radius: 12px; overflow: hidden; background: #f1f5f9; }
    model-viewer { width: 100%; height: 100%; --poster-color: transparent; background: transparent; }
    .mv__overlay {
      position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center;
      gap: 10px; color: #475569; font-size: 13px; text-align: center; padding: 16px; pointer-events: none;
    }
    .mv__overlay--error { color: #64748b; }
    .mv__overlay--info { color: #475569; pointer-events: auto; }
    .mv__ar { display: inline-block; padding: 8px 18px; border-radius: 8px; background: var(--color-brand-600, #2691a4); color: #fff; font-weight: 600; text-decoration: none; }
    .mv__overlay p { margin: 0; max-width: 280px; line-height: 1.5; }
    .mv__spin { width: 26px; height: 26px; border-radius: 50%; border: 3px solid #cbd5e1; border-top-color: var(--color-brand-600, #2691a4); animation: mvspin .8s linear infinite; }
    @keyframes mvspin { to { transform: rotate(360deg); } }
  `],
})
export class ModelViewerComponent implements OnDestroy {
  private media = inject(MediaService);

  /** The media item to show (preferred). */
  mediaId = input<string | null>(null);
  /** Or a ready URL (`blob:` / same-origin). */
  src = input<string | null>(null);
  name = input('3D model');
  /** The file's extension (`usdz` is shown through Apple's AR instead of the in-page viewer). Falls back to the end of `name`. */
  extension = input<string | null>(null);
  isUsdz = computed(() => (this.extension() ?? this.name().split('.').pop() ?? '').toLowerCase() === 'usdz');
  height = input('360px');

  url = signal<string | null>(null);
  /** The original USDZ as a blob URL: what Apple's AR Quick Look opens (`ios-src`, or the "Open in AR" link). */
  arUrl = signal<string | null>(null);
  /** The USDZ could not be converted for display; Apple AR is offered instead. */
  usdzFailed = signal(false);
  state = signal<'loading' | 'ready' | 'error'>('loading');

  private objectUrl: string | null = null;
  private glbUrl: string | null = null;
  private seq = 0;

  constructor() {
    // The web component is registered once, the first time any viewer is created.
    void import('@google/model-viewer');

    effect(() => {
      const id = this.mediaId();
      const src = this.src();
      untracked(() => void this.load(id, src));
    });
  }

  private async load(id: string | null, src: string | null): Promise<void> {
    const mine = ++this.seq;
    this.release();
    this.state.set('loading');
    this.url.set(null);
    this.arUrl.set(null);
    this.usdzFailed.set(false);
    try {
      if (id) {
        const blob = await this.media.getMediaRawBlob(id);
        if (mine !== this.seq) return;
        this.objectUrl = URL.createObjectURL(blob);
        if (this.isUsdz()) {
          // Browsers can't draw USDZ: convert it to a GLB just for display (the stored file is untouched).
          this.arUrl.set(this.objectUrl);
          try {
            const glb = await usdzToGlb(blob);
            if (mine !== this.seq) return;
            this.glbUrl = URL.createObjectURL(glb);
            this.url.set(this.glbUrl);
          } catch {
            if (mine === this.seq) this.usdzFailed.set(true);
          }
        } else {
          this.url.set(this.objectUrl);
        }
      } else if (src) {
        this.url.set(src);
      } else {
        this.state.set('error');
      }
    } catch {
      if (mine === this.seq) this.state.set('error');
    }
  }

  private release(): void {
    if (this.objectUrl) { URL.revokeObjectURL(this.objectUrl); this.objectUrl = null; }
    if (this.glbUrl) { URL.revokeObjectURL(this.glbUrl); this.glbUrl = null; }
  }

  ngOnDestroy(): void { this.seq++; this.release(); }
}
