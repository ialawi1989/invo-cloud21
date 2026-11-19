import { DragIconComponent } from '@shared/components/drag-icon/drag-icon.component';
import {
  ChangeDetectionStrategy, Component, DestroyRef, ElementRef, Injector, afterNextRender, effect, inject, input, output, signal, untracked, viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { CdkDragHandle } from '@angular/cdk/drag-drop';
import { TranslateModule } from '@ngx-translate/core';

import { VoidReasonError, VoidReasonItem, reasonValidator } from './void-reason.validators';

/**
 * One void reason as a list row: drag handle, text, edit and delete. Clicking the text (or the pencil) turns it into an input:
 * Enter saves, Escape cancels, blur saves when valid (an invalid value on blur is dropped, back to the old text).
 *
 * Presentational: it never touches the data, it only emits. Use as `<li app-reason-row cdkDrag ...>`; the drag handle finds the
 * `cdkDrag` of that host through DI, so reordering by mouse works with the parent's `cdkDropList`.
 * Keyboard reordering: focus the handle, then Alt + Arrow Up / Arrow Down emits `move`.
 */
@Component({
  selector: 'li[app-reason-row]',
  standalone: true,
  imports: [DragIconComponent, ReactiveFormsModule, TranslateModule, CdkDragHandle],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { role: 'listitem', class: 'rr', '[class.rr--editing]': 'editing()', '[attr.data-id]': 'item().id' },
  template: `
    <button type="button" class="rr__handle" cdkDragHandle
            [attr.aria-label]="'SETTINGS.POS_OPTIONS.VOID.REORDER' | translate: { name: item().label }"
            [attr.aria-keyshortcuts]="'Alt+ArrowUp Alt+ArrowDown'"
            (keydown)="onHandleKey($event)">
      <app-drag-icon [size]="16"/>
    </button>

    @if (editing()) {
      <div class="rr__edit">
        <input #field class="rr__input" type="text" autocomplete="off" spellcheck="false"
               [formControl]="control"
               [attr.aria-label]="'SETTINGS.POS_OPTIONS.VOID.EDIT_FIELD' | translate"
               [attr.aria-invalid]="control.invalid"
               (keydown.enter)="$event.preventDefault(); commit()"
               (keydown.escape)="$event.preventDefault(); abort()"
               (blur)="onBlur()"/>
        @if (errorKey(); as e) {
          <p class="rr__error" role="alert">{{ 'SETTINGS.POS_OPTIONS.VOID.ERR_' + e.toUpperCase() | translate }}</p>
        }
      </div>
    } @else {
      <button type="button" class="rr__text" (click)="startEdit.emit()"
              [attr.aria-label]="'SETTINGS.POS_OPTIONS.VOID.EDIT_NAMED' | translate: { name: item().label }">
        {{ item().label }}
      </button>
      <span class="rr__actions">
        <button type="button" class="rr__icon" (click)="startEdit.emit()"
                [attr.aria-label]="'SETTINGS.POS_OPTIONS.VOID.EDIT_NAMED' | translate: { name: item().label }">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4z"/>
          </svg>
        </button>
        <button type="button" class="rr__icon rr__icon--danger" (click)="remove.emit()"
                [attr.aria-label]="'SETTINGS.POS_OPTIONS.VOID.DELETE_NAMED' | translate: { name: item().label }">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M3 6h18M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>
            <line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/>
          </svg>
        </button>
      </span>
    }
  `,
  styles: [`
    :host {
      display: flex; align-items: center; gap: 8px; min-height: 44px; padding: 4px 8px 4px 4px;
      background: var(--ui-surface); border: 1px solid var(--ui-line); border-radius: 10px; transition: background .12s, border-color .12s;
    }
    :host(:hover) { background: var(--ui-surface-1); }
    :host(.rr--editing) { border-color: var(--color-brand-600, #2691a4); background: var(--ui-surface); box-shadow: 0 0 0 3px rgba(50, 172, 193, .14); }

    .rr__handle {
      flex: none; display: inline-flex; align-items: center; justify-content: center; width: 28px; height: 32px;
      border: 0; background: transparent; color: var(--ui-faint); cursor: grab; border-radius: 6px;
    }
    .rr__handle:hover { color: var(--ui-text-4); background: var(--ui-surface-2); }
    .rr__handle:active { cursor: grabbing; }
    .rr__handle:focus-visible, .rr__text:focus-visible, .rr__icon:focus-visible { outline: 2px solid var(--color-brand-600, #2691a4); outline-offset: 1px; }

    .rr__text {
      flex: 1; min-width: 0; text-align: start; border: 0; background: transparent; padding: 6px 4px; font: inherit; font-size: 14px;
      color: var(--ui-text); cursor: text; border-radius: 6px; overflow-wrap: anywhere; line-height: 1.4;
    }

    .rr__actions { display: inline-flex; gap: 2px; opacity: 0; transition: opacity .12s; }
    :host(:hover) .rr__actions, :host(:focus-within) .rr__actions { opacity: 1; }
    /* No hover on touch screens: the actions are always there. */
    @media (hover: none) { .rr__actions { opacity: 1; } }

    .rr__icon {
      display: inline-flex; align-items: center; justify-content: center; width: 32px; height: 32px; border: 0; border-radius: 8px;
      background: transparent; color: var(--ui-muted); cursor: pointer;
    }
    .rr__icon:hover { background: var(--ui-line); color: var(--ui-text); }
    .rr__icon--danger:hover { background: var(--ui-red-soft); color: var(--ui-red-text); }

    .rr__edit { flex: 1; min-width: 0; }
    .rr__input {
      width: 100%; padding: 7px 10px; border: 1px solid var(--ui-line-strong); border-radius: 8px; font: inherit; font-size: 14px; color: var(--ui-text); background: var(--ui-field);
    }
    .rr__input:focus { outline: none; border-color: var(--color-brand-600, #2691a4); }
    .rr__input[aria-invalid='true'] { border-color: #ef4444; }
    .rr__error { margin: 4px 0 0; font-size: 12px; color: var(--ui-red-text); }
  `],
})
export class ReasonRowComponent {
  private injector = inject(Injector);
  private destroyRef = inject(DestroyRef);

  item = input.required<VoidReasonItem>();
  editing = input(false);
  /** The other reasons (not this one): a new text may not repeat any of them. */
  taken = input<readonly string[]>([]);

  startEdit = output<void>();
  /** The new text, already trimmed and valid. */
  save = output<string>();
  cancel = output<void>();
  remove = output<void>();
  /** -1 = up, +1 = down (Alt + Arrow on the handle). */
  move = output<-1 | 1>();

  private field = viewChild<ElementRef<HTMLInputElement>>('field');
  private finished = false;

  control = new FormControl('', { nonNullable: true, validators: [reasonValidator(() => this.taken())] });

  /** The first validation error of the input (`required` / `duplicate` / `maxlength`), for the message under it. */
  errorKey = signal<VoidReasonError | null>(null);

  constructor() {
    effect(() => {
      if (!this.editing()) return;
      untracked(() => {
        this.finished = false;
        this.control.setValue(this.item().label);
        this.control.markAsPristine();
        this.control.updateValueAndValidity();
        // The input exists only after this pass renders: focus it (and select the text) then.
        afterNextRender(() => { const el = this.field()?.nativeElement; el?.focus(); el?.select(); }, { injector: this.injector });
      });
    });
    // Leaving the page while an input is focused fires a blur on the way out: by then the outputs are gone, so emit nothing.
    this.destroyRef.onDestroy(() => (this.finished = true));
    // A control's errors are not a signal: mirror them whenever its status changes.
    this.control.statusChanges.pipe(takeUntilDestroyed()).subscribe(() => {
      const e = this.control.errors;
      this.errorKey.set(e ? (Object.keys(e)[0] as VoidReasonError) : null);
    });
  }

  commit(): void {
    if (this.finished) return;
    if (this.control.invalid) return;                       // stay in edit mode; the error is shown under the field
    this.finished = true;
    const value = this.control.value.trim();
    if (value === this.item().label) this.cancel.emit(); else this.save.emit(value);
  }

  abort(): void {
    if (this.finished) return;
    this.finished = true;
    this.cancel.emit();
  }

  onBlur(): void {
    if (this.finished) return;
    if (this.control.valid) this.commit(); else this.abort();
  }

  onHandleKey(e: KeyboardEvent): void {
    if (!e.altKey || (e.key !== 'ArrowUp' && e.key !== 'ArrowDown')) return;
    e.preventDefault();
    this.move.emit(e.key === 'ArrowUp' ? -1 : 1);
  }
}
