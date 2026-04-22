import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TabType } from '../tab-builder.types';

/**
 * Inline SVG mark for a `TabType`. Matches the lucide-equivalent icons used
 * in the React reference (List / Car / FileText / HelpCircle / Code / Table).
 */
@Component({
  selector: 'app-tab-type-icon',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <svg [attr.width]="size()" [attr.height]="size()" viewBox="0 0 24 24" fill="none"
         stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      @switch (type()) {
        @case ('specs') {
          <line x1="8" y1="6"  x2="21" y2="6"/>
          <line x1="8" y1="12" x2="21" y2="12"/>
          <line x1="8" y1="18" x2="21" y2="18"/>
          <line x1="3" y1="6"  x2="3.01" y2="6"/>
          <line x1="3" y1="12" x2="3.01" y2="12"/>
          <line x1="3" y1="18" x2="3.01" y2="18"/>
        }
        @case ('records') {
          <rect x="3" y="4" width="18" height="4" rx="1"/>
          <rect x="3" y="10" width="18" height="4" rx="1"/>
          <rect x="3" y="16" width="18" height="4" rx="1"/>
        }
        @case ('richtext') {
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
          <polyline points="14 2 14 8 20 8"/>
          <line x1="16" y1="13" x2="8" y2="13"/>
          <line x1="16" y1="17" x2="8" y2="17"/>
          <polyline points="10 9 9 9 8 9"/>
        }
        @case ('faq') {
          <circle cx="12" cy="12" r="10"/>
          <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/>
          <line x1="12" y1="17" x2="12.01" y2="17"/>
        }
        @case ('custom') {
          <polyline points="16 18 22 12 16 6"/>
          <polyline points="8 6 2 12 8 18"/>
        }
        @case ('table') {
          <rect x="3" y="3" width="18" height="18" rx="2"/>
          <line x1="3"  y1="9"  x2="21" y2="9"/>
          <line x1="3"  y1="15" x2="21" y2="15"/>
          <line x1="9"  y1="3"  x2="9"  y2="21"/>
          <line x1="15" y1="3"  x2="15" y2="21"/>
        }
        @case ('review') {
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
        }
        @case ('video') {
          <polygon points="23 7 16 12 23 17 23 7"/>
          <rect x="1" y="5" width="15" height="14" rx="2" ry="2"/>
        }
        @case ('downloads') {
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
          <polyline points="7 10 12 15 17 10"/>
          <line x1="12" y1="15" x2="12" y2="3"/>
        }
      }
    </svg>
  `,
  styles: [`
    :host { display: inline-flex; }
  `],
})
export class TabTypeIconComponent {
  type = input.required<TabType>();
  size = input<number>(16);
}
