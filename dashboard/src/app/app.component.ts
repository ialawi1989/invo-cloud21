import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CustomizerComponent } from './components/customizer/customizer.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, CustomizerComponent],
  template: `
    <app-customizer></app-customizer>
  `,
  styles: [`
    :host {
      display: block;
      height: 100vh;
      overflow: hidden;
    }
  `]
})
export class AppComponent {}
