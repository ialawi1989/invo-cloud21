import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  Output,
  ViewEncapsulation,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { RichTooltipDirective } from './rich-tooltip.directive';

export type GalleryLayout =
  | 'grid' | 'masonry' | 'collage' | 'thumbnails'
  | 'slideshow' | 'panorama' | 'columns' | 'slider';
export type GalleryRatio = '16:9' | '4:3' | '1:1' | '3:4' | '9:16';

export type GalleryOrientation = 'vertical' | 'horizontal';
export type GalleryScrollDir = 'vertical' | 'horizontal';
export type GalleryThumbPlacement = 'bottom' | 'top' | 'left' | 'right';

export interface GalleryConfig {
  layout: GalleryLayout;
  /** true = Crop (object-fit: cover); false = Fit (contain). */
  crop: boolean;
  ratio: GalleryRatio;
  /** Images per row (grid). */
  cols: number;
  /** Gap between tiles, px (all layouts). */
  spacing: number;
  /** Masonry row height, px. */
  rowHeight: number;
  /** Collage column width, px. */
  columnWidth: number;
  /** Masonry / collage image orientation. */
  orientation: GalleryOrientation;
  /** Collage scroll direction. */
  scrollDir: GalleryScrollDir;
  /** Thumbnails layout — where the thumbnail strip sits. */
  thumbPlacement: GalleryThumbPlacement;
  clickExpand: boolean;
  allowDownload: boolean;
}
export interface GalleryImage { id: string; url: string; alt: string; mediaId?: string; }

export const DEFAULT_GALLERY_CONFIG: GalleryConfig = {
  layout: 'grid', crop: true, ratio: '1:1', cols: 3,
  spacing: 5, rowHeight: 300, columnWidth: 300,
  orientation: 'horizontal', scrollDir: 'vertical', thumbPlacement: 'bottom',
  clickExpand: true, allowDownload: false,
};

/**
 * Shared gallery editor panel. Three tabs:
 *   • Media   — thumbnail strip with add / remove / reorder + Select all
 *   • Layout  — 8 layout presets + Properties (thumbnail resize, image
 *               ratio, images per row)
 *   • Settings — Click-to-expand / Allow-download toggles
 *
 * Self-contained (ViewEncapsulation.None + own styles) so it behaves
 * identically wherever it's hosted. The host supplies the current
 * config + image list and listens for the granular outputs; the host
 * owns DOM mutation + the media picker (via addImages).
 */
@Component({
  selector: 'app-re-gallery-panel',
  standalone: true,
  imports: [CommonModule, FormsModule, RichTooltipDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  styles: [`
    .re-gal-panel { display: flex; flex-direction: column; width: 320px; max-width: 90vw; }
    .re-gal-panel__head {
      display: flex; align-items: center; justify-content: space-between;
      padding: 12px 16px; border-bottom: 1px solid #e2e8f0; cursor: grab; user-select: none;
    }
    .re-gal-panel__head:active { cursor: grabbing; }
    .re-gal-panel__head h4 { margin: 0; font-weight: 700; font-size: 15px; line-height: 1.2; color: #0f172a; }
    .re-gal-panel__close {
      width: 28px; height: 28px; display: inline-flex; align-items: center; justify-content: center;
      border: none; background: transparent; border-radius: 6px; color: #64748b; cursor: pointer;
    }
    .re-gal-panel__close:hover { background: #f1f5f9; color: #0f172a; }
    .re-gal-tabs { display: flex; border-bottom: 1px solid #e2e8f0; }
    .re-gal-tab {
      flex: 1; padding: 10px 8px; background: transparent; border: none; cursor: pointer;
      font-weight: 600; font-size: 13px; line-height: 1; color: #64748b; border-bottom: 2px solid transparent;
    }
    .re-gal-tab.is-on { color: var(--ricos-custom-settings-action-color, #32acc1);
      border-bottom-color: var(--ricos-custom-settings-action-color, #32acc1); }
    .re-gal-body { padding: 14px 16px; display: flex; flex-direction: column; gap: 12px; max-height: 60vh; overflow-y: auto; }

    /* Media tab */
    .re-gal-mediaHead { display: flex; align-items: center; justify-content: space-between; }
    .re-gal-link { background: none; border: none; color: var(--ricos-custom-settings-action-color, #32acc1);
      font-weight: 600; font-size: 13px; line-height: 1; cursor: pointer; padding: 0; text-decoration: underline; }
    .re-gal-thumbs { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
    .re-gal-add {
      display: flex; align-items: center; justify-content: center; aspect-ratio: 1;
      border: 1px dashed #cbd5e1; border-radius: 8px; background: #f8fafc;
      color: var(--ricos-custom-settings-action-color, #32acc1); cursor: pointer;
    }
    .re-gal-add:hover { border-color: var(--ricos-custom-settings-action-color, #32acc1); }
    .re-gal-thumb { position: relative; aspect-ratio: 1; border-radius: 8px; overflow: hidden;
      border: 1px solid #e2e8f0; cursor: grab; }
    .re-gal-thumb.is-drag-over { outline: 2px solid var(--ricos-custom-settings-action-color, #32acc1); }
    .re-gal-thumb img { width: 100%; height: 100%; object-fit: cover; display: block; }
    .re-gal-thumb__rm {
      position: absolute; top: 4px; right: 4px; width: 20px; height: 20px; border-radius: 50%;
      border: none; background: rgba(15,23,42,.65); color: #fff; cursor: pointer;
      display: inline-flex; align-items: center; justify-content: center; padding: 0;
    }
    .re-gal-thumb__rm:hover { background: #dc2626; }

    /* Layout tab */
    .re-gal-section {
      font-weight: 600; font-size: 13px; line-height: 1; color: #0f172a;
      margin-top: 4px; padding-top: 14px; border-top: 1px solid #e2e8f0;
    }
    .re-gal-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; }
    /* Each option = a bordered icon box with the label OUTSIDE below
       it (icon box with the label below). Selected → primary ring on the
       box + checkmark badge + primary label. */
    .re-gal-opt {
      display: flex; flex-direction: column; align-items: center; gap: 5px;
      background: none; border: none; padding: 0; cursor: pointer;
      color: #475569; position: relative; min-width: 0;
    }
    .re-gal-optBox {
      position: relative;
      width: 100%; aspect-ratio: 1 / 1; display: flex; align-items: center; justify-content: center;
      border: 1px solid #e2e8f0; border-radius: 8px; background: #fff;
      color: #5b6472; transition: border-color 120ms, box-shadow 120ms;
    }
    .re-gal-opt:hover .re-gal-optBox { border-color: #cbd5e1; }
    .re-gal-opt.is-on .re-gal-optBox {
      border-color: var(--ricos-custom-settings-action-color, #32acc1);
      box-shadow: 0 0 0 1px var(--ricos-custom-settings-action-color, #32acc1);
      color: var(--ricos-custom-settings-action-color, #32acc1);
    }
    .re-gal-opt.is-on { color: var(--ricos-custom-settings-action-color, #32acc1); }
    .re-gal-optBox svg { width: 60%; height: 60%; }
    .re-gal-optLabel {
      max-width: 100%; text-align: center; font-weight: 400; font-size: 12px; line-height: 1.2;
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    }
    .re-gal-opt__check {
      position: absolute; top: -6px; right: -6px; width: 16px; height: 16px; border-radius: 50%;
      background: var(--ricos-custom-settings-action-color, #32acc1); color: #fff;
      display: inline-flex; align-items: center; justify-content: center;
    }
    .re-gal-seg { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
    .re-gal-segBtn {
      display: inline-flex; align-items: center; justify-content: center; gap: 6px; padding: 8px;
      border: 1px solid #e2e8f0; border-radius: 8px; background: #fff; cursor: pointer;
      font-weight: 600; font-size: 13px; line-height: 1; color: #475569;
    }
    .re-gal-segBtn.is-on { border-color: var(--ricos-custom-settings-action-color, #32acc1);
      color: var(--ricos-custom-settings-action-color, #32acc1); }
    .re-gal-ratios { display: grid; grid-template-columns: repeat(5, 1fr); gap: 8px; }
    .re-gal-placements { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; }
    /* Ratio option mirrors the layout option: a bordered box with the
       ratio glyph inside + label OUTSIDE below. Selected → primary
       ring on the box + checkmark + primary label. */
    .re-gal-ratio {
      display: flex; flex-direction: column; align-items: center; gap: 5px;
      background: none; border: none; padding: 0; cursor: pointer;
      color: #475569; position: relative; min-width: 0;
    }
    .re-gal-ratioBox {
      position: relative;
      width: 100%; aspect-ratio: 1 / 1; display: flex; align-items: center; justify-content: center;
      border: 1px solid #e2e8f0; border-radius: 8px; background: #fff;
      color: #5b6472; transition: border-color 120ms, box-shadow 120ms;
    }
    .re-gal-ratio:hover .re-gal-ratioBox { border-color: #cbd5e1; }
    .re-gal-ratio.is-on .re-gal-ratioBox {
      border-color: var(--ricos-custom-settings-action-color, #32acc1);
      box-shadow: 0 0 0 1px var(--ricos-custom-settings-action-color, #32acc1);
      color: var(--ricos-custom-settings-action-color, #32acc1);
    }
    .re-gal-ratio.is-on { color: var(--ricos-custom-settings-action-color, #32acc1); }
    .re-gal-ratio__box { border: 1.5px solid currentColor; border-radius: 2px; }
    .re-gal-ratioLabel {
      max-width: 100%; text-align: center; font-weight: 400; font-size: 12px; line-height: 1.2;
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    }
    .re-gal-ratio__check {
      position: absolute; top: -6px; right: -6px; width: 16px; height: 16px; border-radius: 50%;
      background: var(--ricos-custom-settings-action-color, #32acc1); color: #fff;
      display: inline-flex; align-items: center; justify-content: center;
    }
    .re-gal-row { display: flex; align-items: center; gap: 12px; }
    /* composer-style range slider — thin track, filled (primary) left
       portion via a gradient driven by --fill, round handle. */
    .re-gal-slider {
      flex: 1;
      -webkit-appearance: none; appearance: none;
      height: 16px; background: transparent; cursor: pointer; outline: none; margin: 0;
      --fill: 50%;
    }
    .re-gal-slider::-webkit-slider-runnable-track {
      height: 4px; border-radius: 999px;
      background: linear-gradient(to right,
        var(--ricos-custom-settings-action-color, #32acc1) var(--fill),
        #e2e8f0 var(--fill));
    }
    .re-gal-slider::-moz-range-track {
      height: 4px; border-radius: 999px;
      background: linear-gradient(to right,
        var(--ricos-custom-settings-action-color, #32acc1) var(--fill),
        #e2e8f0 var(--fill));
    }
    .re-gal-slider::-webkit-slider-thumb {
      -webkit-appearance: none; appearance: none;
      width: 16px; height: 16px; margin-top: -6px; border-radius: 50%;
      background: var(--ricos-custom-settings-action-color, #32acc1);
      border: 2px solid #fff; box-shadow: 0 1px 4px rgba(15,23,42,.25);
    }
    .re-gal-slider::-moz-range-thumb {
      width: 16px; height: 16px; border-radius: 50%;
      background: var(--ricos-custom-settings-action-color, #32acc1);
      border: 2px solid #fff; box-shadow: 0 1px 4px rgba(15,23,42,.25);
    }
    .re-gal-num {
      width: 56px; padding: 6px 8px; border: 1px solid #e2e8f0; border-radius: 6px;
      font-weight: 500; font-size: 13px; line-height: 1; text-align: center; box-sizing: border-box;
    }
    .re-gal-num:focus { outline: none; border-color: var(--ricos-custom-settings-action-color, #32acc1); }

    /* Settings tab */
    .re-gal-toggleRow {
      display: flex; align-items: center; justify-content: space-between;
      font-weight: 400; font-size: 13px; line-height: 1.3; color: #1e293b;
    }
    .re-gal-labelGroup { display: inline-flex; align-items: center; gap: 4px; }
    .re-gal-info { display: inline-flex; align-items: center; justify-content: center;
      width: 16px; height: 16px; color: #94a3b8; cursor: help; }
    .re-gal-toggle {
      display: inline-block; width: 28px; height: 16px; background: #cbd5e1; border-radius: 999px;
      position: relative; transition: background 120ms; cursor: pointer; flex-shrink: 0;
    }
    .re-gal-toggle::after { content: ''; position: absolute; top: 2px; left: 2px; width: 12px; height: 12px;
      background: #fff; border-radius: 50%; transition: transform 120ms; }
    .re-gal-toggle.is-on { background: var(--ricos-custom-settings-action-color, #32acc1); }
    .re-gal-toggle.is-on::after { transform: translateX(12px); }
  `],
  template: `
    <div class="re-gal-panel">
      <header class="re-gal-panel__head" (mousedown)="headerPointerDown.emit($event)">
        <h4>Gallery</h4>
        <button type="button" class="re-gal-panel__close" (click)="close.emit()" (mousedown)="$event.stopPropagation()" aria-label="Close">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </header>

      <nav class="re-gal-tabs">
        <button type="button" class="re-gal-tab" [class.is-on]="tab() === 'media'" (click)="tab.set('media')">Media</button>
        <button type="button" class="re-gal-tab" [class.is-on]="tab() === 'layout'" (click)="tab.set('layout')">Layout</button>
        <button type="button" class="re-gal-tab" [class.is-on]="tab() === 'settings'" (click)="tab.set('settings')">Settings</button>
      </nav>

      <div class="re-gal-body">
        @switch (tab()) {
          @case ('media') {
            <div class="re-gal-mediaHead">
              <button type="button" class="re-gal-link" (click)="addImages.emit()">Add media</button>
              <button type="button" class="re-gal-link" (click)="selectAll.emit()">Select All ({{ images.length }})</button>
            </div>
            <div class="re-gal-thumbs">
              <button type="button" class="re-gal-add" (click)="addImages.emit()" aria-label="Add images">
                <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              </button>
              @for (img of images; track img.id; let i = $index) {
                <div class="re-gal-thumb"
                     [class.is-drag-over]="dragOverIndex() === i"
                     draggable="true"
                     (dragstart)="onDragStart(i)"
                     (dragover)="onDragOver($event, i)"
                     (drop)="onDrop(i)"
                     (dragend)="onDragEnd()">
                  <img [src]="img.url" [alt]="img.alt"/>
                  <button type="button" class="re-gal-thumb__rm" (click)="removeImage.emit(img.id)" aria-label="Remove">
                    <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                  </button>
                </div>
              }
            </div>
          }

          @case ('layout') {
            <div class="re-gal-grid">
              @for (l of layouts; track l.id) {
                <button type="button" class="re-gal-opt" [class.is-on]="cfg().layout === l.id" (click)="setLayout(l.id)" [title]="l.label">
                  <span class="re-gal-optBox">
                    <svg viewBox="0 0 50 50" fill="currentColor" aria-hidden="true"><path fill-rule="evenodd" [attr.d]="l.icon"></path></svg>
                    @if (cfg().layout === l.id) {
                      <span class="re-gal-opt__check"><svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg></span>
                    }
                  </span>
                  <span class="re-gal-optLabel">{{ l.label }}</span>
                </button>
              }
            </div>

            <div class="re-gal-section">Properties</div>
            <!-- Per-layout properties — each layout exposes a different
                 control set (matches the design). Reusable controls are defined
                 as ng-templates below and composed per layout here. -->
            @switch (cfg().layout) {
              @case ('grid') {
                <ng-container [ngTemplateOutlet]="tplThumbResize"></ng-container>
                <ng-container [ngTemplateOutlet]="tplImageRatio"></ng-container>
                <ng-container [ngTemplateOutlet]="tplImagesPerRow"></ng-container>
              }
              @case ('masonry') {
                <ng-container [ngTemplateOutlet]="tplOrientation"></ng-container>
                <ng-container [ngTemplateOutlet]="tplRowHeight"></ng-container>
                <ng-container [ngTemplateOutlet]="tplSpacing"></ng-container>
              }
              @case ('collage') {
                <ng-container [ngTemplateOutlet]="tplScrollDir"></ng-container>
                <ng-container [ngTemplateOutlet]="tplOrientation"></ng-container>
                <ng-container [ngTemplateOutlet]="tplColumnWidth"></ng-container>
                <ng-container [ngTemplateOutlet]="tplSpacing"></ng-container>
              }
              @case ('thumbnails') {
                <ng-container [ngTemplateOutlet]="tplThumbPlacement"></ng-container>
                <ng-container [ngTemplateOutlet]="tplSpacing"></ng-container>
              }
              @case ('slider') {
                <ng-container [ngTemplateOutlet]="tplSpacing"></ng-container>
                <ng-container [ngTemplateOutlet]="tplThumbResize"></ng-container>
                <ng-container [ngTemplateOutlet]="tplImageRatio"></ng-container>
              }
              @case ('slideshow') {
                <ng-container [ngTemplateOutlet]="tplThumbResize"></ng-container>
                <ng-container [ngTemplateOutlet]="tplImageRatio"></ng-container>
              }
              @default {
                <!-- panorama / columns -->
                <ng-container [ngTemplateOutlet]="tplSpacing"></ng-container>
              }
            }
          }

          @case ('settings') {
            <div class="re-gal-toggleRow">
              <span class="re-gal-labelGroup">Click to expand
                <span class="re-gal-info" [appReTooltip]="'Open the image full-size when a reader clicks it.'">
                  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
                </span>
              </span>
              <span class="re-gal-toggle" [class.is-on]="cfg().clickExpand" (mousedown)="$event.preventDefault(); setClickExpand(!cfg().clickExpand)"></span>
            </div>
            <div class="re-gal-toggleRow">
              <span class="re-gal-labelGroup">Allow download
                <span class="re-gal-info" [appReTooltip]="'Let readers download the original image.'">
                  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
                </span>
              </span>
              <span class="re-gal-toggle" [class.is-on]="cfg().allowDownload" (mousedown)="$event.preventDefault(); setAllowDownload(!cfg().allowDownload)"></span>
            </div>
          }
        }
      </div>
    </div>

    <!-- ── Reusable property controls (composed per layout above) ── -->
    <ng-template #tplThumbResize>
      <div class="re-gal-labelGroup">Thumbnail resize
        <span class="re-gal-info" [appReTooltip]="'Crop fills each tile; Fit shows the whole image.'">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
        </span>
      </div>
      <div class="re-gal-seg">
        <button type="button" class="re-gal-segBtn" [class.is-on]="cfg().crop" (click)="setCrop(true)">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 2v14a2 2 0 0 0 2 2h14"/><path d="M18 22V8a2 2 0 0 0-2-2H2"/></svg>
          Crop
        </button>
        <button type="button" class="re-gal-segBtn" [class.is-on]="!cfg().crop" (click)="setCrop(false)">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="2"/></svg>
          Fit
        </button>
      </div>
    </ng-template>

    <ng-template #tplImageRatio>
      <div class="re-gal-labelGroup">Image ratio</div>
      <div class="re-gal-ratios">
        @for (r of ratios; track r.id) {
          <button type="button" class="re-gal-ratio" [class.is-on]="cfg().ratio === r.id" (click)="setRatio(r.id)" [title]="r.id">
            <span class="re-gal-ratioBox">
              <span class="re-gal-ratio__box" [style.width.px]="r.w" [style.height.px]="r.h"></span>
              @if (cfg().ratio === r.id) {
                <span class="re-gal-ratio__check"><svg viewBox="0 0 24 24" width="9" height="9" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg></span>
              }
            </span>
            <span class="re-gal-ratioLabel">{{ r.id }}</span>
          </button>
        }
      </div>
    </ng-template>

    <ng-template #tplImagesPerRow>
      <div class="re-gal-labelGroup">Images per row</div>
      <div class="re-gal-row">
        <input type="range" min="1" max="6" class="re-gal-slider"
               [style.--fill]="fill(cfg().cols, 1, 6)"
               [ngModel]="cfg().cols" (ngModelChange)="setCols($event)"/>
        <input type="number" min="1" max="6" class="re-gal-num" [ngModel]="cfg().cols" (ngModelChange)="setCols($event)"/>
      </div>
    </ng-template>

    <ng-template #tplSpacing>
      <div class="re-gal-labelGroup">Spacing (px)
        <span class="re-gal-info" [appReTooltip]="'Gap between images.'">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
        </span>
      </div>
      <div class="re-gal-row">
        <input type="range" min="0" max="40" class="re-gal-slider"
               [style.--fill]="fill(cfg().spacing, 0, 40)"
               [ngModel]="cfg().spacing" (ngModelChange)="setSpacing($event)"/>
        <input type="number" min="0" max="40" class="re-gal-num" [ngModel]="cfg().spacing" (ngModelChange)="setSpacing($event)"/>
      </div>
    </ng-template>

    <ng-template #tplRowHeight>
      <div class="re-gal-labelGroup">{{ cfg().orientation === 'vertical' ? 'Column height' : 'Row height' }}</div>
      <div class="re-gal-row">
        <input type="range" min="100" max="600" class="re-gal-slider"
               [style.--fill]="fill(cfg().rowHeight, 100, 600)"
               [ngModel]="cfg().rowHeight" (ngModelChange)="setRowHeight($event)"/>
        <input type="number" min="100" max="600" class="re-gal-num" [ngModel]="cfg().rowHeight" (ngModelChange)="setRowHeight($event)"/>
      </div>
    </ng-template>

    <ng-template #tplColumnWidth>
      <div class="re-gal-labelGroup">{{ cfg().orientation === 'vertical' ? 'Column width' : 'Row height' }}</div>
      <div class="re-gal-row">
        <input type="range" min="100" max="600" class="re-gal-slider"
               [style.--fill]="fill(cfg().columnWidth, 100, 600)"
               [ngModel]="cfg().columnWidth" (ngModelChange)="setColumnWidth($event)"/>
        <input type="number" min="100" max="600" class="re-gal-num" [ngModel]="cfg().columnWidth" (ngModelChange)="setColumnWidth($event)"/>
      </div>
    </ng-template>

    <ng-template #tplOrientation>
      <div class="re-gal-labelGroup">Image orientation
        <span class="re-gal-info" [appReTooltip]="'How each image is oriented within the layout.'">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
        </span>
      </div>
      <div class="re-gal-seg">
        <button type="button" class="re-gal-segBtn" [class.is-on]="cfg().orientation === 'vertical'" (click)="setOrientation('vertical')">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><rect x="8" y="4" width="8" height="16" rx="1"/></svg>
          Vertical
        </button>
        <button type="button" class="re-gal-segBtn" [class.is-on]="cfg().orientation === 'horizontal'" (click)="setOrientation('horizontal')">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><rect x="4" y="8" width="16" height="8" rx="1"/></svg>
          Horizontal
        </button>
      </div>
    </ng-template>

    <ng-template #tplScrollDir>
      <div class="re-gal-labelGroup">Scroll direction
        <span class="re-gal-info" [appReTooltip]="'Which way the gallery scrolls.'">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
        </span>
      </div>
      <div class="re-gal-seg">
        <button type="button" class="re-gal-segBtn" [class.is-on]="cfg().scrollDir === 'vertical'" (click)="setScrollDir('vertical')">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><rect x="8" y="4" width="8" height="16" rx="1"/></svg>
          Vertical
        </button>
        <button type="button" class="re-gal-segBtn" [class.is-on]="cfg().scrollDir === 'horizontal'" (click)="setScrollDir('horizontal')">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><rect x="4" y="8" width="16" height="8" rx="1"/></svg>
          Horizontal
        </button>
      </div>
    </ng-template>

    <ng-template #tplThumbPlacement>
      <div class="re-gal-labelGroup">Thumbnail placement</div>
      <div class="re-gal-placements">
        @for (p of thumbPlacements; track p) {
          <button type="button" class="re-gal-ratio" [class.is-on]="cfg().thumbPlacement === p" (click)="setThumbPlacement(p)" [title]="p">
            <span class="re-gal-ratioBox">
              <svg viewBox="0 0 50 50" width="62%" height="62%" fill="currentColor" aria-hidden="true"
                   [style.transform]="placementRotation(p)">
                <path [attr.d]="THUMB_PLACEMENT_ICON"/>
              </svg>
              @if (cfg().thumbPlacement === p) {
                <span class="re-gal-ratio__check"><svg viewBox="0 0 24 24" width="9" height="9" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg></span>
              }
            </span>
          </button>
        }
      </div>
    </ng-template>
  `,
})
export class RichGalleryPanelComponent {
  @Input() set config(v: GalleryConfig | null | undefined) {
    this.cfg.set({ ...DEFAULT_GALLERY_CONFIG, ...(v ?? {}) });
  }
  @Input() images: GalleryImage[] = [];

  @Output() configChange = new EventEmitter<GalleryConfig>();
  @Output() addImages    = new EventEmitter<void>();
  @Output() removeImage  = new EventEmitter<string>();
  @Output() reorder      = new EventEmitter<{ from: number; to: number }>();
  @Output() selectAll    = new EventEmitter<void>();
  @Output() close        = new EventEmitter<void>();
  @Output() headerPointerDown = new EventEmitter<MouseEvent>();

  tab = signal<'media' | 'layout' | 'settings'>('layout');
  cfg = signal<GalleryConfig>({ ...DEFAULT_GALLERY_CONFIG });
  dragOverIndex = signal<number | null>(null);
  private dragFrom: number | null = null;

  // gallery layout glyphs — raw <path d> data, rendered inline in
  // the template (binding to [attr.d] avoids Angular stripping the SVG
  // that [innerHTML] sanitization would remove).
  readonly layouts: Array<{ id: GalleryLayout; label: string; icon: string }> = [
    { id: 'grid',       label: 'Grid',       icon: 'M3 2h20a1 1 0 0 1 1 1v20a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1zm0 1v20h20V3H3zm24-1h20a1 1 0 0 1 1 1v20a1 1 0 0 1-1 1H27a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1zm0 1v20h20V3H27zM3 26h20a1 1 0 0 1 1 1v20a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V27a1 1 0 0 1 1-1zm0 1v20h20V27H3zm24-1h20a1 1 0 0 1 1 1v20a1 1 0 0 1-1 1H27a1 1 0 0 1-1-1V27a1 1 0 0 1 1-1zm0 1v20h20V27H27z' },
    { id: 'masonry',    label: 'Masonry',    icon: 'M3 2h27a1 1 0 0 1 1 1v20a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1zm0 1v20h27V3H3zm31-1h13a1 1 0 0 1 1 1v20a1 1 0 0 1-1 1H34a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1zm0 1v20h13V3H34zM3 26h13a1 1 0 0 1 1 1v20a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V27a1 1 0 0 1 1-1zm0 1v20h13V27H3zm17-1h27a1 1 0 0 1 1 1v20a1 1 0 0 1-1 1H20a1 1 0 0 1-1-1V27a1 1 0 0 1 1-1zm0 1v20h27V27H20z' },
    { id: 'collage',    label: 'Collage',    icon: 'M3 2h20a1 1 0 0 1 1 1v20a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1zm0 1v20h20V3H3zm24-1h20a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H27a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1zm0 1v10h20V3H27zm0 13h8a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1h-8a1 1 0 0 1-1-1v-6a1 1 0 0 1 1-1zm0 1v6h8v-6h-8zm12-1h8a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1h-8a1 1 0 0 1-1-1v-6a1 1 0 0 1 1-1zm0 1v6h8v-6h-8zM3 38h26a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1v-8a1 1 0 0 1 1-1zm0 1v8h26v-8H3zm0-13h26a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1v-8a1 1 0 0 1 1-1zm0 1v8h26v-8H3zm30-1h14a1 1 0 0 1 1 1v20a1 1 0 0 1-1 1H33a1 1 0 0 1-1-1V27a1 1 0 0 1 1-1zm0 1v20h14V27H33z' },
    { id: 'thumbnails', label: 'Thumbnails', icon: 'M3 2h44a1 1 0 0 1 1 1v31a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1zm0 1v31h44V3H3zm0 34h12a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1zm0 1v9h12v-9H3zm16-1h12a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H19a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1zm0 1v9h12v-9H19zm16-1h12a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H35a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1zm0 1v9h12v-9H35zM11.32 20.616a.5.5 0 1 1-.64.768l-3-2.5a.5.5 0 0 1 0-.768l3-2.5a.5.5 0 1 1 .64.768L8.781 18.5l2.54 2.116zm27.36-4.232a.5.5 0 1 1 .64-.768l3 2.5a.5.5 0 0 1 0 .768l-3 2.5a.5.5 0 1 1-.64-.768l2.539-2.116-2.54-2.116z' },
    { id: 'slideshow',  label: 'Slideshow',  icon: 'M3 2h44a1 1 0 0 1 1 1v44a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1zm0 1v44h44V3H3zm8.32 24.616a.5.5 0 1 1-.64.768l-3-2.5a.5.5 0 0 1 0-.768l3-2.5a.5.5 0 1 1 .64.768L8.781 25.5l2.54 2.116zm27.36-4.232a.5.5 0 1 1 .64-.768l3 2.5a.5.5 0 0 1 0 .768l-3 2.5a.5.5 0 1 1-.64-.768l2.539-2.116-2.54-2.116z' },
    { id: 'panorama',   label: 'Panorama',   icon: 'M3 2h44a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1zm0 1v14h44V3H3zm0 17h44a1 1 0 0 1 1 1v7a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1v-7a1 1 0 0 1 1-1zm0 1v7h44v-7H3zm0 10h44a1 1 0 0 1 1 1v15a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V32a1 1 0 0 1 1-1zm0 1v15h44V32H3z' },
    { id: 'columns',    label: 'Columns',    icon: 'M3 2h11a1 1 0 0 1 1 1v44a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1zm0 1v44h11V3H3zm15-1h14a1 1 0 0 1 1 1v44a1 1 0 0 1-1 1H18a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1zm0 1v44h14V3H18zm18-1h11a1 1 0 0 1 1 1v44a1 1 0 0 1-1 1H36a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1zm0 1v44h11V3H36z' },
    // id stays 'slider' (persisted galleries + CSS use it); the label is
    // "Carousel" — a centred slide with prev/next arrows (galleryLayout:4).
    { id: 'slider',     label: 'Carousel',   icon: 'M14 8h22a1 1 0 0 1 1 1v32a1 1 0 0 1-1 1H14a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1zm0 1v32h22V9H14zM9 18 3 25 9 32ZM41 18 47 25 41 32Z' },
  ];

  // Ratio swatch box dimensions (visual only).
  readonly ratios: Array<{ id: GalleryRatio; w: number; h: number }> = [
    { id: '16:9', w: 26, h: 15 },
    { id: '4:3',  w: 22, h: 16 },
    { id: '1:1',  w: 18, h: 18 },
    { id: '3:4',  w: 16, h: 22 },
    { id: '9:16', w: 13, h: 24 },
  ];

  /** Thumbnail-placement options for the Thumbnails layout. */
  readonly thumbPlacements: GalleryThumbPlacement[] = ['bottom', 'top', 'left', 'right'];

  /** Placement glyph — a large stage image with prev/next chevrons over
   *  a strip of three thumbnails. Drawn for the BOTTOM case and rotated
   *  per placement (see placementRotation), so one path covers all four. */
  readonly THUMB_PLACEMENT_ICON =
    'M3 2h44a1 1 0 0 1 1 1v31a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1zm0 1v31h44V3H3zm0 34h12a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1zm0 1v9h12v-9H3zm16-1h12a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H19a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1zm0 1v9h12v-9H19zm16-1h12a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H35a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1zm0 1v9h12v-9H35zM11.32 20.616a.5.5 0 1 1-.64.768l-3-2.5a.5.5 0 0 1 0-.768l3-2.5a.5.5 0 1 1 .64.768L8.781 18.5l2.54 2.116zm27.36-4.232a.5.5 0 1 1 .64-.768l3 2.5a.5.5 0 0 1 0 .768l-3 2.5a.5.5 0 1 1-.64-.768l2.539-2.116-2.54-2.116z';

  /** Rotate the base (bottom-strip) glyph so the strip lands on the
   *  chosen side: bottom→0°, left→90°, top→180°, right→270°. */
  placementRotation(p: GalleryThumbPlacement): string {
    return { bottom: 'none', left: 'rotate(90deg)', top: 'rotate(180deg)', right: 'rotate(270deg)' }[p];
  }

  /** Generic filled-track percentage for a range slider — drives the
   *  --fill gradient stop on `.re-gal-slider`. */
  fill(value: number, min: number, max: number): string {
    const pct = ((value - min) / (max - min)) * 100;
    return `${Math.max(0, Math.min(100, pct))}%`;
  }

  private commit(patch: Partial<GalleryConfig>): void {
    const next = { ...this.cfg(), ...patch };
    this.cfg.set(next);
    this.configChange.emit(next);
  }
  setLayout(layout: GalleryLayout): void { this.commit({ layout }); }
  setCrop(crop: boolean): void { this.commit({ crop }); }
  setRatio(ratio: GalleryRatio): void { this.commit({ ratio }); }
  setCols(v: number): void { this.commit({ cols: Math.max(1, Math.min(6, +v || 1)) }); }
  setSpacing(v: number): void { this.commit({ spacing: Math.max(0, Math.min(40, +v || 0)) }); }
  setRowHeight(v: number): void { this.commit({ rowHeight: Math.max(100, Math.min(600, +v || 100)) }); }
  setColumnWidth(v: number): void { this.commit({ columnWidth: Math.max(100, Math.min(600, +v || 100)) }); }
  setOrientation(orientation: GalleryOrientation): void { this.commit({ orientation }); }
  setScrollDir(scrollDir: GalleryScrollDir): void { this.commit({ scrollDir }); }
  setThumbPlacement(thumbPlacement: GalleryThumbPlacement): void { this.commit({ thumbPlacement }); }
  setClickExpand(v: boolean): void { this.commit({ clickExpand: v }); }
  setAllowDownload(v: boolean): void { this.commit({ allowDownload: v }); }

  // Drag-to-reorder within the Media strip.
  onDragStart(i: number): void { this.dragFrom = i; }
  onDragOver(ev: DragEvent, i: number): void { ev.preventDefault(); this.dragOverIndex.set(i); }
  onDrop(to: number): void {
    const from = this.dragFrom;
    this.dragOverIndex.set(null);
    this.dragFrom = null;
    if (from === null || from === to) return;
    this.reorder.emit({ from, to });
  }
  onDragEnd(): void { this.dragOverIndex.set(null); this.dragFrom = null; }
}
