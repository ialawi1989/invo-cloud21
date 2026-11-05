import '../../account-i18n';
import { ChangeDetectionStrategy, Component, ElementRef, HostListener, OnDestroy, TemplateRef, ViewContainerRef, inject, input, model, signal, viewChild } from '@angular/core';
import { Overlay, OverlayRef } from '@angular/cdk/overlay';
import { TemplatePortal } from '@angular/cdk/portal';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Several e-mail recipients in one field: type an address and press Enter (or `,` / `;`, or paste a list) to make a
 * chip; ✕ removes it, double-click edits it in place, right-click offers Copy / Cut / Change. Used by every "send by
 * e-mail" dialog (`SendDocumentModal`, `InvoiceLinkModal`). A half-typed address is committed on blur; call
 * {@link flush} before sending so one still in the input isn't lost.
 */
@Component({
  selector: 'app-email-chips',
  standalone: true,
  imports: [FormsModule, TranslateModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './email-chips.component.html',
  styleUrl: './email-chips.component.scss',
})
export class EmailChipsComponent implements OnDestroy {
  /** The recipients (two-way). */
  readonly emails = model<string[]>([]);
  readonly disabled = input(false);

  readonly draft = signal('');
  readonly error = signal('');
  /** The chip being edited in place (`old` = the address it had when editing began). */
  readonly editing = signal<{ old: string; value: string } | null>(null);
  /** The chip the open context menu belongs to. */
  menuEmail = '';

  private host = inject(ElementRef<HTMLElement>);
  private overlay = inject(Overlay);
  private vcr = inject(ViewContainerRef);
  private menuTpl = viewChild<TemplateRef<unknown>>('menuTpl');
  private menuRef: OverlayRef | null = null;

  /** Commits what is typed in the input. Returns false when it isn't a valid address (the error is shown). */
  flush(): boolean { this.commit(); return !this.error(); }

  commit(ev?: Event): void {
    const raw = this.draft().trim().replace(/[,;]$/, '');
    if (!raw) { this.error.set(''); return; }
    ev?.preventDefault();
    if (!EMAIL_RE.test(raw)) { this.error.set('DOC_SEND.ERR_EMAIL'); return; }
    this.error.set('');
    if (!this.emails().includes(raw)) this.emails.update(l => [...l, raw]);
    this.draft.set('');
  }
  onKey(ev: KeyboardEvent): void {
    if (ev.key === 'Enter' || ev.key === ',' || ev.key === ';') this.commit(ev);
  }
  onPaste(ev: ClipboardEvent): void {
    const text = ev.clipboardData?.getData('text') ?? '';
    if (!/[,;\s]/.test(text.trim())) return;
    ev.preventDefault();
    const valid = text.split(/[,;\s]+/).filter(t => EMAIL_RE.test(t));
    this.emails.update(l => [...l, ...valid.filter(v => !l.includes(v))]);
  }
  remove(e: string): void { this.emails.update(l => l.filter(x => x !== e)); }

  // ── context menu ──
  /** Right-click on a chip: only what makes sense for an address — copy, cut, change. */
  openMenu(ev: MouseEvent, email: string): void {
    ev.preventDefault();
    ev.stopPropagation();
    const tpl = this.menuTpl();
    if (!tpl) return;
    this.closeMenu();
    this.menuEmail = email;
    // An overlay (not an inline fixed box): dialogs are transformed and clipped, which misplaces / hides fixed children.
    this.menuRef = this.overlay.create({
      hasBackdrop: true,
      backdropClass: 'cdk-overlay-transparent-backdrop',
      scrollStrategy: this.overlay.scrollStrategies.close(),
      positionStrategy: this.overlay.position().flexibleConnectedTo({ x: ev.clientX, y: ev.clientY })
        .withPositions([
          { originX: 'start', originY: 'top', overlayX: 'start', overlayY: 'top' },
          { originX: 'start', originY: 'bottom', overlayX: 'start', overlayY: 'bottom' },
        ]).withFlexibleDimensions(false).withPush(true),
    });
    this.menuRef.attach(new TemplatePortal(tpl, this.vcr));
    this.menuRef.backdropClick().subscribe(() => this.closeMenu());
    this.menuRef.backdropElement?.addEventListener('contextmenu', e => { e.preventDefault(); this.closeMenu(); });
  }
  closeMenu(): void { this.menuRef?.dispose(); this.menuRef = null; }
  ngOnDestroy(): void { this.closeMenu(); }
  @HostListener('document:keydown.escape') onEscape(): void { this.closeMenu(); }

  copy(email: string): void { void navigator.clipboard?.writeText(email); this.closeMenu(); }
  cut(email: string): void { void navigator.clipboard?.writeText(email); this.remove(email); this.closeMenu(); }

  // ── inline edit ──
  startEdit(email: string): void {
    this.closeMenu();
    if (this.disabled()) return;
    this.error.set('');
    this.editing.set({ old: email, value: email });
    setTimeout(() => (this.host.nativeElement as HTMLElement).querySelector<HTMLInputElement>('.ec__input--edit')?.select());
  }
  editValue(value: string): void { this.editing.update(e => (e ? { ...e, value } : e)); }
  onEditKey(ev: KeyboardEvent): void {
    if (ev.key === 'Enter') { ev.preventDefault(); this.commitEdit(false); }
    else if (ev.key === 'Escape') { ev.stopPropagation(); this.editing.set(null); }
  }
  /** Replaces the chip with the edited address. Invalid input keeps the editor open on Enter and is discarded on blur. */
  commitEdit(fromBlur: boolean): void {
    const e = this.editing();
    if (!e) return;
    const value = e.value.trim().replace(/[,;]$/, '');
    if (!EMAIL_RE.test(value)) {
      if (fromBlur) { this.editing.set(null); return; }
      this.error.set('DOC_SEND.ERR_EMAIL');
      return;
    }
    this.error.set('');
    this.emails.update(l => {
      const next = l.map(x => (x === e.old ? value : x));
      return next.filter((x, i) => next.indexOf(x) === i);
    });
    this.editing.set(null);
  }
}
