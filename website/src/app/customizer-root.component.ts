import { Component, computed } from '@angular/core';
import { CommonModule } from '@angular/common';

import { PreviewService } from './services/preview.service';
import { DynamicComponentComponent } from './components/dynamic/dynamic-component.component';

/**
 * Customizer landing page body. The site-wide header/footer chrome
 * lives in AppComponent so it wraps every route (blog included);
 * this component only renders the dynamic-component canvas slotted
 * into `<router-outlet>`.
 */
@Component({
  selector: 'app-customizer-root',
  standalone: true,
  imports: [CommonModule, DynamicComponentComponent],
  template: `
    @if (components().length === 0) {
      <div class="empty-page">
        <h2>Start Building Your Page</h2>
        <p>Add components from the library to get started</p>
      </div>
    } @else {
      @for (component of sortedComponents(); track component.id) {
        <app-dynamic-component [component]="component"></app-dynamic-component>
      }
    }
  `,
  styles: [`
    .empty-page { display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 60vh; text-align: center; opacity: .5; }
  `],
})
export class CustomizerRoot {
  constructor(private previewService: PreviewService) {}
  get components() { return this.previewService.components; }
  sortedComponents = computed(() => [...this.previewService.components()].sort((a, b) => a.order - b.order));
}
