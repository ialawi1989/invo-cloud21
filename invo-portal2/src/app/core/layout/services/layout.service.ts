import { Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class LayoutService {
  /** When true, the main-content wrapper renders with zero padding */
  readonly noPadding = signal(false);

  setNoPadding(value: boolean): void {
    this.noPadding.set(value);
  }
}
