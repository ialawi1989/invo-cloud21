import { ChangeDetectionStrategy, Component, ElementRef, HostListener, inject, input, output, signal, viewChild } from '@angular/core';

export interface RowMenuItem { id: string; label: string; danger?: boolean; disabled?: boolean; separator?: boolean }

/**
 * A "⋯" menu button with proper menu semantics: aria-haspopup / aria-expanded, a role="menu" list, arrow keys,
 * Home / End, Escape (focus returns to the button), Enter / Space to pick. The panel is `position: fixed` under the
 * button, so a scrolling or clipped parent never cuts it off. Presentational: it reports the item picked.
 */
@Component({
  selector: 'app-row-menu',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './row-menu.component.html',
  styleUrl: './row-menu.component.scss',
})
export class RowMenuComponent {
  /** Names the trigger for screen readers, e.g. "Actions for section Rice". */
  label = input.required<string>();
  items = input<RowMenuItem[]>([]);
  pick = output<string>();

  open = signal(false);
  pos = signal<{ top: number; left: number } | null>(null);
  private host = inject<ElementRef<HTMLElement>>(ElementRef);
  private trigger = viewChild<ElementRef<HTMLButtonElement>>('trigger');
  private panel = viewChild<ElementRef<HTMLElement>>('panel');

  toggle(ev: Event): void {
    ev.stopPropagation();
    this.open() ? this.close(true) : this.show();
  }

  private show(): void {
    const r = this.trigger()?.nativeElement.getBoundingClientRect();
    if (!r) return;
    const rtl = document.dir === 'rtl';
    // 176px = the panel's min width: keep it on screen whichever side the button is on.
    const left = rtl ? Math.max(8, r.left) : Math.min(window.innerWidth - 184, Math.max(8, r.right - 176));
    this.pos.set({ top: r.bottom + 4, left });
    this.open.set(true);
    queueMicrotask(() => this.itemEls()[0]?.focus());
  }

  close(returnFocus = false): void {
    this.open.set(false);
    if (returnFocus) this.trigger()?.nativeElement.focus();
  }

  choose(item: RowMenuItem): void {
    if (item.disabled) return;
    this.close(true);
    this.pick.emit(item.id);
  }

  private itemEls(): HTMLElement[] {
    return Array.from(this.panel()?.nativeElement.querySelectorAll<HTMLElement>('[role="menuitem"]:not([disabled])') ?? []);
  }

  onKey(e: KeyboardEvent): void {
    const els = this.itemEls();
    const i = els.indexOf(document.activeElement as HTMLElement);
    const go = (n: number) => { e.preventDefault(); els[(n + els.length) % els.length]?.focus(); };
    switch (e.key) {
      case 'ArrowDown': go(i + 1); break;
      case 'ArrowUp': go(i - 1); break;
      case 'Home': go(0); break;
      case 'End': go(els.length - 1); break;
      case 'Escape': e.preventDefault(); e.stopPropagation(); this.close(true); break;
      case 'Tab': this.close(); break;
    }
  }

  onTriggerKey(e: KeyboardEvent): void {
    if (e.key === 'ArrowDown' && !this.open()) { e.preventDefault(); this.show(); }
  }

  @HostListener('document:click', ['$event'])
  onDocClick(e: Event): void {
    if (this.open() && !this.host.nativeElement.contains(e.target as Node)) this.close();
  }
  @HostListener('window:scroll')
  @HostListener('window:resize')
  onViewportChange(): void { if (this.open()) this.close(); }
}
