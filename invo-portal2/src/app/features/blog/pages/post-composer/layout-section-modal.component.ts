import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { TranslateModule } from '@ngx-translate/core';

import { MODAL_REF } from '@shared/modal/modal.tokens';
import { ModalRef } from '@shared/modal/modal.service';
import { ModalHeaderComponent } from '@shared/modal/modal-header.component';

/**
 * "Layout section" picker — blank columns (2 / 3) + a few content
 * presets. Returns the chosen banner-preset id, which the editor's
 * `applyBannerPreset()` turns into a multi-column banner. Mirrors the
 * add-table modal's structure.
 */
@Component({
  selector: 'app-layout-section-modal',
  standalone: true,
  imports: [CommonModule, TranslateModule, ModalHeaderComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-modal-header [title]="'BLOG.COMPOSER.LAYOUT_MODAL_TITLE' | translate" />

    <div class="lm__body">
      <section>
        <h4 class="lm__group">{{ 'BLOG.COMPOSER.LAYOUT_BLANK' | translate }}</h4>
        <div class="lm__grid">
          <button type="button" class="lm__tile" (click)="pick('lay-2col')">
            <span class="lm__thumb"><i></i><i></i></span>
            <span class="lm__name">{{ 'BLOG.COMPOSER.LAYOUT_2COL' | translate }}</span>
          </button>
          <button type="button" class="lm__tile" (click)="pick('lay-3col')">
            <span class="lm__thumb"><i></i><i></i><i></i></span>
            <span class="lm__name">{{ 'BLOG.COMPOSER.LAYOUT_3COL' | translate }}</span>
          </button>
          <button type="button" class="lm__tile" (click)="pick('lay-4col')">
            <span class="lm__thumb"><i></i><i></i><i></i><i></i></span>
            <span class="lm__name">{{ 'BLOG.COMPOSER.LAYOUT_4COL' | translate }}</span>
          </button>
        </div>
      </section>

      <section>
        <h4 class="lm__group">{{ 'BLOG.COMPOSER.LAYOUT_PRESETS' | translate }}</h4>
        <div class="lm__grid lm__grid--presets">
          @for (p of presets; track p.id) {
            <button type="button" class="lm__tile lm__tile--preset" (click)="pick(p.id)" [title]="p.name">
              <span class="lm__pthumb" [innerHTML]="p.thumb"></span>
              <span class="lm__name">{{ p.name }}</span>
            </button>
          }
        </div>
      </section>
    </div>
  `,
  styles: [`
    .lm__body { padding: 16px 20px 20px; display: flex; flex-direction: column; gap: 18px; max-height: 70vh; overflow: auto; }
    .lm__group { margin: 0 0 10px; font-size: 13px; font-weight: 700; color: #0f172a; }
    .lm__grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    .lm__tile {
      display: flex; flex-direction: column; align-items: center; gap: 8px;
      padding: 14px; border: 1.5px solid #e2e8f0; border-radius: 10px; background: #fff; cursor: pointer;
      transition: border-color .1s, background .1s;
    }
    .lm__tile:hover { border-color: #32acc1; background: #f0fafc; }
    .lm__thumb { display: flex; gap: 6px; width: 90px; height: 56px; }
    .lm__thumb i { flex: 1; border: 1.5px solid #cbd5e1; border-radius: 4px; }
    .lm__name { font-size: 12px; color: #475569; }
    .lm__pthumb { display: block; width: 110px; height: 64px; }
    .lm__pthumb :where(svg) { width: 100%; height: 100%; }
  `],
})
export class LayoutSectionModalComponent {
  ref = inject<ModalRef<string | undefined>>(MODAL_REF);
  private san = inject(DomSanitizer);

  /** Content presets → existing banner-preset ids + a mini SVG thumb. */
  readonly presets: { id: string; name: string; thumb: SafeHtml }[] = [
    { id: 'split',    name: 'Image + text', thumb: this.san.bypassSecurityTrustHtml(this.thumbImgText()) },
    { id: 'dark',     name: 'Two columns',  thumb: this.san.bypassSecurityTrustHtml(this.thumbTwoText()) },
    { id: 'lay-3img', name: '3 images',     thumb: this.san.bypassSecurityTrustHtml(this.thumbThreeImg()) },
    { id: 'lay-4img', name: '4 images',     thumb: this.san.bypassSecurityTrustHtml(this.thumbFourImg()) },
  ];

  pick(id: string): void { this.ref.close(id); }

  private thumbImgText(): string {
    return `<svg viewBox="0 0 110 64" fill="none"><rect x="2" y="2" width="50" height="60" rx="4" fill="#dbeafe"/><line x1="60" y1="16" x2="104" y2="16" stroke="#cbd5e1" stroke-width="4"/><line x1="60" y1="30" x2="104" y2="30" stroke="#e2e8f0" stroke-width="4"/><rect x="60" y="44" width="28" height="10" rx="3" fill="#2563eb"/></svg>`;
  }
  private thumbTwoText(): string {
    return `<svg viewBox="0 0 110 64" fill="none"><line x1="4" y1="14" x2="50" y2="14" stroke="#cbd5e1" stroke-width="4"/><line x1="4" y1="28" x2="50" y2="28" stroke="#e2e8f0" stroke-width="4"/><line x1="60" y1="14" x2="106" y2="14" stroke="#cbd5e1" stroke-width="4"/><line x1="60" y1="28" x2="106" y2="28" stroke="#e2e8f0" stroke-width="4"/></svg>`;
  }
  private thumbThreeImg(): string {
    return `<svg viewBox="0 0 110 64" fill="none"><rect x="2" y="2" width="32" height="40" rx="3" fill="#dbeafe"/><rect x="39" y="2" width="32" height="40" rx="3" fill="#dbeafe"/><rect x="76" y="2" width="32" height="40" rx="3" fill="#dbeafe"/><line x1="2" y1="50" x2="34" y2="50" stroke="#e2e8f0" stroke-width="3"/><line x1="39" y1="50" x2="71" y2="50" stroke="#e2e8f0" stroke-width="3"/><line x1="76" y1="50" x2="108" y2="50" stroke="#e2e8f0" stroke-width="3"/></svg>`;
  }
  private thumbFourImg(): string {
    return `<svg viewBox="0 0 110 64" fill="none"><rect x="2" y="2" width="23" height="40" rx="3" fill="#dbeafe"/><rect x="29" y="2" width="23" height="40" rx="3" fill="#dbeafe"/><rect x="56" y="2" width="23" height="40" rx="3" fill="#dbeafe"/><rect x="83" y="2" width="23" height="40" rx="3" fill="#dbeafe"/></svg>`;
  }
}
