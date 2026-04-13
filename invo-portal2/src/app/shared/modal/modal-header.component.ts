import { Component, Input, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ModalRef } from './modal.service';

/**
 * Optional convenience header for modal content components.
 * Usage: <app-modal-header title="Edit Invoice" />
 */
@Component({
  selector: 'app-modal-header',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="mh">
      <div class="mh-left">
        @if (icon) {
          <div class="mh-icon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
                 stroke="currentColor" stroke-width="2"
                 [innerHTML]="icon"></svg>
          </div>
        }
        <div>
          <h4 class="mh-title">{{ title }}</h4>
          @if (subtitle) { <p class="mh-sub">{{ subtitle }}</p> }
        </div>
      </div>
    </div>
    <div class="mh-divider"></div>
  `,
  styles: [`
    .mh {
      display: flex; align-items: center;
      padding: 20px 52px 16px 24px;
    }
    .mh-left { display: flex; align-items: center; gap: 12px; }
    .mh-icon {
      width: 40px; height: 40px; border-radius: 10px; flex-shrink: 0;
      background: linear-gradient(135deg, #e8f8fb, #d0eef5);
      color: #32acc1;
      display: flex; align-items: center; justify-content: center;
    }
    .mh-title { font-size: 15px; font-weight: 600; color: #111827; margin: 0 0 2px; }
    .mh-sub   { font-size: 12px; color: #9ca3af; margin: 0; }
    .mh-divider { height: 1px; background: #f1f5f9; }
  `]
})
export class ModalHeaderComponent {
  @Input() title    = '';
  @Input() subtitle = '';
  @Input() icon     = '';   // raw SVG path string e.g. "<path d='...'/>"
}
