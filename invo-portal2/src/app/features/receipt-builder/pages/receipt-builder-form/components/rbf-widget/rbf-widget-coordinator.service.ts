import { Injectable, signal } from '@angular/core';

/**
 * Lightweight broadcast bus so a rail header can flip every widget's
 * collapsed state at once. Each widget in the page subscribes via
 * `effect()` and applies the command if its `storageKey` starts with
 * the broadcast prefix — empty prefix matches everything.
 *
 * The `version` field guarantees that repeat clicks on the same button
 * (collapse-all twice in a row) re-fire the effect even though the
 * payload looks identical to Angular's signal equality check.
 */
@Injectable({ providedIn: 'root' })
export class RbfWidgetCoordinator {
  readonly command = signal<{
    keyPrefix: string;
    collapsed: boolean;
    v: number;
  } | null>(null);

  private version = 0;

  setAll(keyPrefix: string, collapsed: boolean): void {
    this.command.set({ keyPrefix, collapsed, v: ++this.version });
  }
}
