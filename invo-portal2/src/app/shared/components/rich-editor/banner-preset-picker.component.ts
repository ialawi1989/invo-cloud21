import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ModalRef } from '../../modal/modal.service';
import { MODAL_DATA, MODAL_REF } from '../../modal/modal.tokens';

export interface BannerPresetDescriptor {
  id: string;
  name: string;
  description: string;
}

export interface BannerPresetPickerData {
  presets: ReadonlyArray<BannerPresetDescriptor>;
}

@Component({
  selector: 'app-banner-preset-picker',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header class="bpp-head">
      <h4>Choose a banner preset</h4>
    </header>
    <div class="bpp-grid">
      @for (p of data.presets; track p.id) {
        <button type="button" class="bpp-card" (click)="pick(p.id)">
          <span class="bpp-name">{{ p.name }}</span>
          <span class="bpp-desc">{{ p.description }}</span>
        </button>
      }
    </div>
  `,
  styles: [`
    :host { display: block; }
    .bpp-head {
      padding: 16px 20px;
      border-bottom: 1px solid #e2e8f0;
    }
    .bpp-head h4 { margin: 0; font: 600 16px/1 inherit; color: #0f172a; }
    .bpp-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 12px;
      padding: 16px 20px 20px;
      overflow-y: auto;
    }
    .bpp-card {
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      gap: 4px;
      padding: 16px;
      background: #fff;
      border: 1.5px solid #e2e8f0;
      border-radius: 8px;
      cursor: pointer;
      text-align: left;
      transition: border-color .12s, background-color .12s, transform .12s;
    }
    .bpp-card:hover {
      border-color: #32acc1;
      background: #f0fafc;
      transform: translateY(-1px);
    }
    .bpp-name { font: 600 14px/1.2 inherit; color: #0f172a; }
    .bpp-desc { font: 400 12px/1.4 inherit; color: #64748b; }
  `],
})
export class BannerPresetPickerComponent {
  private modalRef = inject<ModalRef<string>>(MODAL_REF);
  protected data   = inject<BannerPresetPickerData>(MODAL_DATA);

  pick(id: string): void { this.modalRef.close(id); }
}
