import { Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class LayoutService {
  /** When true, the main-content wrapper renders with zero padding */
  readonly noPadding = signal(false);

  setNoPadding(value: boolean): void {
    this.noPadding.set(value);
  }

  /** A page asks for the side menu to collapse while it is open (wide, full-width pages). The user can still re-expand it manually. */
  readonly collapseSidebar = signal(false);

  setCollapseSidebar(value: boolean): void {
    this.collapseSidebar.set(value);
  }
}
