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
    /* Sticky to the bottom of the scrollable drawer / modal body so
       the action buttons stay visible while the user scrolls long
       forms (SEO editor, complex settings, etc.). \`margin-top: auto\`
       pushes the footer to the bottom when content is short. */
    :host {
      position: sticky;
      bottom: 0;
      margin-top: auto;
      background: #fff;
      z-index: 5;
    }
    .mf-divider { height: 1px; background: #f1f5f9; }
    .mf {
      display: flex; align-items: center; justify-content: flex-end; gap: 10px;
      padding: 16px 24px;
      background: #fff;
    }
  `]
})
export class ModalFooterComponent {}
