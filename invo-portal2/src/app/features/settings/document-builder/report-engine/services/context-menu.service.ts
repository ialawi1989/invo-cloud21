import { Injectable, computed, signal } from '@angular/core';

/**
 * Tracks the open state of the canvas right-click menu. The menu component
 * subscribes to the position signal; right-click handlers on canvas blocks
 * call `show(x, y)` after selecting the target block.
 */
@Injectable({ providedIn: 'root' })
export class ContextMenuService {
  private readonly _state = signal<{ x: number; y: number } | null>(null);
  readonly state = this._state.asReadonly();
  readonly open = computed(() => this._state() !== null);

  show(x: number, y: number): void { this._state.set({ x, y }); }
  hide(): void { this._state.set(null); }
}
