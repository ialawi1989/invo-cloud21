import { ChangeDetectionStrategy, Component, HostListener, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ContextMenuService } from '../../services/context-menu.service';
import { DesignerStateService } from '../../services/designer-state.service';

/**
 * Right-click menu rendered as a fixed-position overlay with a full-viewport
 * backdrop catching outside clicks — standard popover behaviour.
 *
 * Every action applies to the whole current selection. Right-clicking a
 * block selects it first (see CanvasBlockComponent), so a right-click on an
 * unselected block still does the obvious thing, while a right-click inside
 * a multi-selection operates on all of it.
 */
@Component({
  selector: 'app-canvas-context-menu',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule],
  templateUrl: './canvas-context-menu.component.html',
  styleUrls: ['./canvas-context-menu.component.scss'],
})
export class CanvasContextMenuComponent {
  readonly svc = inject(ContextMenuService);
  private readonly state = inject(DesignerStateService);

  /** True only when EVERY selected block is locked. A mixed selection
   *  reports false so the menu offers "Lock" — one coherent action rather
   *  than a per-block toggle the user can't predict. */
  readonly isLocked = computed<boolean>(() => {
    const sel = this.state.selectedBlocks();
    return sel.length > 0 && sel.every((b) => !!b.locked);
  });

  duplicate(): void {
    this.state.duplicateSelected();
    this.svc.hide();
  }

  del(): void {
    this.state.deleteSelected();
    this.svc.hide();
  }

  toggleLock(): void {
    const target = !this.isLocked();
    for (const b of this.state.selectedBlocks()) {
      this.state.patchBlock(b.id, (cur) => ({ ...cur, locked: target }));
    }
    this.svc.hide();
  }

  bringToFront(): void {
    for (const b of this.state.selectedBlocks()) this.state.bringToFront(b.id);
    this.svc.hide();
  }

  sendToBack(): void {
    for (const b of this.state.selectedBlocks()) this.state.sendToBack(b.id);
    this.svc.hide();
  }

  onBackdropContextMenu(ev: MouseEvent): void {
    ev.preventDefault();
    this.svc.hide();
  }

  /** Escape closes the menu so it can't trap the user. */
  @HostListener('window:keydown.escape')
  onEscape(): void {
    this.svc.hide();
  }
}
