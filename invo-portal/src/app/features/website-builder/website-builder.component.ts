import { Component } from '@angular/core';
import { CustomizerComponent } from './components/customizer/customizer.component';

@Component({
  selector: 'app-website-builder',
  standalone: true,
  imports: [CustomizerComponent],
  template: `<app-customizer></app-customizer>`,
  styles: [`
    :host {
      display: block;
      height: 100vh;
      overflow: hidden;
    }
  `]
})
export class WebsiteBuilderComponent {}
