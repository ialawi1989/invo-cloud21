import { Component } from '@angular/core';

/**
 * Sticky footer bar for modal action buttons.
 * Usage: wrap your buttons inside <app-modal-footer>
 */
@Component({
  selector: 'app-modal-footer',
  standalone: true,
  template: `
    <div class="mf-divider"></div>
    <div class="mf"><ng-content /></div>
  `,
  styles: [`
    .mf-divider { height: 1px; background: #f1f5f9; }
    .mf {
      display: flex; align-items: center; justify-content: flex-end; gap: 10px;
      padding: 16px 24px;
    }
  `]
})
export class ModalFooterComponent {}
