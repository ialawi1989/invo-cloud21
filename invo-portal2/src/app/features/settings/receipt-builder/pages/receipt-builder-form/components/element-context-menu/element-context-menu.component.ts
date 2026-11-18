import { ChangeDetectionStrategy, Component, EventEmitter, HostListener, Input, Output, computed, signal } from '@angular/core';

/** One row of the menu. `divider` rows only draw a line. */
export interface CtxItem {
  id: string;
  label?: string;
  /** Key into `ICONS` (feather-style paths). */
  icon?: string;
  shortcut?: string;
  danger?: boolean;
  disabled?: boolean;
  divider?: boolean;
  /** Draws a check mark: the option is currently on. */
  checked?: boolean;
  run?: () => void;
}

/** Stroke paths (24x24 viewBox) for the icons the items ask for. */
const ICONS: Record<string, string> = {
  duplicate: 'M8 8h12v12H8z M4 16V4h12',
  copy: 'M8 8h12v12H8z M4 16V4h12',
  paste: 'M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2 M9 2h6v4H9z',
  up: 'M12 19V5 M5 12l7-7 7 7',
  down: 'M12 5v14 M19 12l-7 7-7-7',
  top: 'M5 3h14 M12 21V8 M5 14l7-7 7 7',
  bottom: 'M5 21h14 M12 3v13 M19 10l-7 7-7-7',
  eye: 'M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z',
  eyeoff: 'M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94 M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19 M1 1l22 22',
  trash: 'M3 6h18 M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6 M10 11v6 M14 11v6',
  bold: 'M6 4h8a4 4 0 0 1 0 8H6z M6 12h9a4 4 0 0 1 0 8H6z',
  alignL: 'M3 6h18 M3 12h12 M3 18h16',
  alignC: 'M3 6h18 M6 12h12 M4 18h16',
  alignR: 'M3 6h18 M9 12h12 M5 18h16',
  plus: 'M12 5v14 M5 12h14',
  minus: 'M5 12h14',
  line: 'M3 12h18',
  list: 'M8 6h13 M8 12h13 M8 18h13 M3 6h.01 M3 12h.01 M3 18h.01',
};

/**
 * Right-click menu for a receipt element. It only draws what it is given: the form decides which options apply to the
 * element's type. A full-screen backdrop closes it on any outside click, right-click or Escape.
 */
@Component({
  selector: 'app-element-context-menu',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './element-context-menu.component.html',
  styleUrl: './element-context-menu.component.scss',
})
export class ElementContextMenuComponent {
  @Input({ required: true }) set items(v: CtxItem[]) { this._items.set(v); }
  @Input({ required: true }) set x(v: number) { this._x.set(v); }
  @Input({ required: true }) set y(v: number) { this._y.set(v); }
  @Output() closed = new EventEmitter<void>();

  private _items = signal<CtxItem[]>([]);
  private _x = signal(0);
  private _y = signal(0);
  rows = this._items.asReadonly();

  /** Keeps the menu inside the viewport (a rough height from the row count; rows are ~34px, dividers ~9px). */
  pos = computed(() => {
    const items = this._items();
    const h = items.reduce((s, i) => s + (i.divider ? 9 : 34), 12);
    const w = 220;
    return {
      left: Math.max(8, Math.min(this._x(), window.innerWidth - w - 8)),
      top: Math.max(8, Math.min(this._y(), window.innerHeight - h - 8)),
    };
  });

  path(icon: string | undefined): string { return (icon && ICONS[icon]) || ''; }

  pick(item: CtxItem): void {
    if (item.disabled || item.divider) return;
    this.closed.emit();
    item.run?.();
  }

  @HostListener('window:keydown.escape') onEscape(): void { this.closed.emit(); }
  @HostListener('window:resize') onResize(): void { this.closed.emit(); }
}
