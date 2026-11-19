import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  HostListener,
  ViewChild,
  computed,
  effect,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
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
  imports: [CommonModule, TranslateModule],
  templateUrl: './canvas-context-menu.component.html',
  styleUrls: ['./canvas-context-menu.component.scss'],
})
export class CanvasContextMenuComponent {
  readonly svc = inject(ContextMenuService);
  private readonly state = inject(DesignerStateService);

  /** Gap kept between the menu and the viewport edge. */
  private static readonly EDGE_MARGIN = 8;

  private menuEl: HTMLElement | null = null;

  /** Fires when *ngIf puts the menu in the DOM (and again with `undefined`
   *  when it's removed), which is the first moment it can be measured. */
  @ViewChild('menu') set menu(ref: ElementRef<HTMLElement> | undefined) {
    this.menuEl = ref?.nativeElement ?? null;
    if (this.menuEl) this.place();
  }

  constructor() {
    // The setter only fires when *ngIf creates the element. Re-opening the
    // menu at a new spot while it's already open reuses that element, so
    // follow the position signal too.
    effect(() => {
      this.svc.state();
      this.place();
    });
  }

  /**
   * Anchor the menu at the cursor, flipping it back over the cursor on either
   * axis when it would otherwise run off-screen — right-clicking a block near
   * the bottom of the canvas used to open a menu whose lower half was cut off.
   *
   * Done imperatively rather than through a style binding: the size can only
   * be read once the element exists, and writing a signal from a view-query
   * setter would land mid-change-detection.
   */
  private place(): void {
    const el = this.menuEl;
    const pos = this.svc.state();
    if (!el || !pos) return;

    const margin = CanvasContextMenuComponent.EDGE_MARGIN;
    const { width, height } = el.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    // Opens down-right by default. Flipping to the other side of the cursor
    // beats merely clamping — a clamped menu would sit under the pointer.
    let x = pos.x;
    if (x + width + margin > viewportWidth) x = pos.x - width;

    let y = pos.y;
    if (y + height + margin > viewportHeight) y = pos.y - height;

    // A menu taller than the viewport can't fit either way; pin it to the top
    // edge and let `max-height` scroll it.
    el.style.left = `${Math.max(margin, x)}px`;
    el.style.top = `${Math.max(margin, y)}px`;
  }

  /** Re-place on resize so an open menu can't be stranded off-screen. */
  @HostListener('window:resize')
  onResize(): void {
    this.place();
  }

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
