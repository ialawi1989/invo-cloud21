import { ChangeDetectionStrategy, Component, ElementRef, HostListener, computed, inject, input, output, signal } from '@angular/core';
import { AbstractControl } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';

export interface FormErrorItem {
  label: string;
  required: boolean;
  el: HTMLElement;
}

/**
 * <app-form-error-summary>
 * ────────────────────────
 * Clickable "N errors" indicator for sticky form footers. Opening it lists every
 * invalid field currently rendered inside `container` (by label); clicking an
 * entry scrolls to that field and focuses it. Errors with no rendered field
 * (collapsed/removed sections, array-level rules) are counted in a trailing note.
 *
 *   <app-form-error-summary [count]="errorCount()" [form]="form" [container]="host"/>
 */
@Component({
  selector: 'app-form-error-summary',
  standalone: true,
  imports: [TranslateModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button type="button" class="fes__trigger" [attr.aria-expanded]="open()" (click)="toggle()">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
      </svg>
      {{ count() }} {{ (count() === 1 ? 'COMMON.ERROR' : 'COMMON.ERRORS') | translate }}
    </button>

    @if (open()) {
      <div class="fes__panel" role="dialog">
        <div class="fes__title">{{ 'COMMON.FORM_ERRORS.TITLE' | translate }}</div>
        <ul class="fes__list">
          @for (it of items(); track $index) {
            <li>
              <button type="button" class="fes__item" (click)="jump(it)">
                <span class="fes__label">{{ it.label }}</span>
                <span class="fes__hint">{{ (it.required ? 'COMMON.FORM_ERRORS.REQUIRED' : 'COMMON.FORM_ERRORS.INVALID') | translate }}</span>
              </button>
            </li>
          }
        </ul>
        @if (hiddenCount() > 0) {
          <div class="fes__more">{{ 'COMMON.FORM_ERRORS.HIDDEN' | translate: { count: hiddenCount() } }}</div>
        }
      </div>
    }
  `,
  styles: [`
    :host { position: relative; display: inline-flex; margin-inline-end: auto; }
    .fes__trigger {
      display: inline-flex; align-items: center; gap: 6px; padding: 4px 8px; margin-inline-start: -8px;
      border: 0; border-radius: 6px; background: transparent; cursor: pointer;
      font: inherit; font-size: 12px; font-weight: 600; color: #b91c1c;
      svg { color: #dc2626; }
      &:hover { background: #fef2f2; text-decoration: underline; }
    }
    .fes__panel {
      position: absolute; inset-inline-start: 0; bottom: calc(100% + 12px); z-index: 70;
      width: 320px; max-width: 80vw; max-height: 320px; overflow-y: auto;
      background: #fff; border: 1px solid #fecaca; border-radius: 10px;
      box-shadow: 0 12px 28px rgba(15, 23, 42, .16); padding: 8px;
    }
    .fes__title { padding: 4px 8px 6px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .04em; color: #64748b; }
    .fes__list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 2px; }
    .fes__item {
      display: flex; width: 100%; align-items: center; justify-content: space-between; gap: 10px;
      padding: 8px 10px; border: 0; border-radius: 6px; background: transparent; cursor: pointer; text-align: start;
      font: inherit; font-size: 13px; color: #0f172a;
      &:hover { background: #fef2f2; }
    }
    .fes__label { min-width: 0; overflow-wrap: anywhere; }
    .fes__hint { flex: none; font-size: 11px; font-weight: 600; color: #dc2626; }
    .fes__more { padding: 6px 10px 2px; font-size: 12px; color: #64748b; }
  `],
})
export class FormErrorSummaryComponent {
  /** Total invalid controls reported by the host form (drives the label). */
  readonly count = input.required<number>();
  /** Optional: marked as touched on open so inline messages appear too. */
  readonly form = input<AbstractControl | null>(null);
  /** DOM subtree searched for invalid fields. */
  readonly container = input.required<HTMLElement>();
  /** Fired just before scrolling to a field, so a tabbed host can show the pane holding it. */
  readonly jumping = output<HTMLElement>();

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  readonly open = signal(false);
  private readonly snapshot = signal<FormErrorItem[]>([]);
  readonly items = this.snapshot.asReadonly();
  readonly hiddenCount = computed(() => Math.max(0, this.count() - this.snapshot().length));

  toggle(): void {
    if (this.open()) { this.open.set(false); return; }
    this.form()?.markAllAsTouched();
    this.snapshot.set(this.collect());
    this.open.set(true);
  }

  jump(it: FormErrorItem): void {
    this.open.set(false);
    this.jumping.emit(it.el);
    // Deferred a tick so a host that switches tab/pane in response has
    // rendered the field before we measure and scroll to it.
    setTimeout(() => {
      // Scroll the nearest rendered ancestor if the field itself is collapsed away.
      let target: HTMLElement | null = it.el;
      while (target && target.offsetParent === null && target.parentElement) target = target.parentElement;
      (target ?? it.el).scrollIntoView({ behavior: 'smooth', block: 'center' });
      const focusable = it.el.matches('input,select,textarea,button')
        ? it.el
        : it.el.querySelector<HTMLElement>('input,select,textarea,button,[tabindex]');
      setTimeout(() => focusable?.focus({ preventScroll: true }), 250);
    });
  }

  @HostListener('document:click', ['$event'])
  onDocClick(e: MouseEvent): void {
    if (this.open() && !this.host.nativeElement.contains(e.target as Node)) this.open.set(false);
  }

  @HostListener('document:keydown.escape')
  onEsc(): void { this.open.set(false); }

  private collect(): FormErrorItem[] {
    const els = Array.from(this.container().querySelectorAll<HTMLElement>('[formcontrolname].ng-invalid'));
    const out: FormErrorItem[] = [];
    for (const el of els) {
      if (el.closest('app-form-error-summary')) continue;
      out.push({ el, label: this.labelFor(el), required: this.isEmpty(el) });
    }
    return out;
  }

  /** Empty value → "Required"; anything else → generic "Invalid". */
  private isEmpty(el: HTMLElement): boolean {
    const input = (el.matches('input,select,textarea') ? el : el.querySelector('input,select,textarea')) as HTMLInputElement | null;
    return !input || input.value === '' || input.value == null;
  }

  private labelFor(el: HTMLElement): string {
    const clean = (s: string | null | undefined) => (s ?? '').replace(/[*​]/g, '').replace(/\s+/g, ' ').trim();
    const id = el.id || el.querySelector('input,select,textarea')?.id;
    if (id) {
      const byFor = this.container().querySelector<HTMLElement>(`label[for="${CSS.escape(id)}"]`);
      if (byFor && clean(byFor.textContent)) return clean(byFor.textContent);
    }
    let p: HTMLElement | null = el.parentElement;
    for (let depth = 0; p && depth < 4; depth++, p = p.parentElement) {
      // Stop once the wrapper holds more than one control — the label would be a neighbour's.
      if (depth > 0 && p.querySelectorAll('[formcontrolname]').length > 1) break;
      const lab = p.querySelector<HTMLElement>('label, .label, .field-label');
      if (lab && !lab.contains(el) && clean(lab.textContent)) return clean(lab.textContent);
    }
    const aria = clean(el.getAttribute('aria-label') || el.getAttribute('placeholder'));
    if (aria) return aria;
    const name = el.getAttribute('formcontrolname') ?? '';
    return name.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/^./, c => c.toUpperCase());
  }
}
