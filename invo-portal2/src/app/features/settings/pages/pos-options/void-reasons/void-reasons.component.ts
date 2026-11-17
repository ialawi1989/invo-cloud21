import {
  ChangeDetectionStrategy, Component, ElementRef, Injector, afterNextRender, computed, effect, inject, input, output, signal, untracked, viewChild,
} from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { CdkDragDrop, DragDropModule, moveItemInArray } from '@angular/cdk/drag-drop';
import { LiveAnnouncer } from '@angular/cdk/a11y';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { merge } from 'rxjs';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

import { ToastService } from '@shared/components/toast/toast.service';
import { ReasonRowComponent } from './reason-row.component';
import { SuggestionChipsComponent } from './suggestion-chips.component';
import {
  MAX_VOID_REASONS, MAX_VOID_REASON_LENGTH, VoidReasonError, VoidReasonItem, newReasonId, normalizeReason, reasonValidator,
} from './void-reason.validators';

/** Suggested reasons: translation keys under `SETTINGS.POS_OPTIONS.VOID.SUGGEST_*`, resolved to text when shown. */
const SUGGESTION_KEYS = ['WRONG_ITEM', 'PRICE_ERROR', 'DAMAGED', 'UNAVAILABLE', 'DUPLICATE'] as const;
/** Suggestions are shown while the list is shorter than this. */
const SUGGEST_BELOW = 5;
/** How long the "Removed. Undo" message stays. */
const UNDO_MS = 5000;

/**
 * Void reasons editor: the predefined reasons a cashier picks from when voiding an item, as an editable, reorderable list.
 *
 * Contract with the parent: `reasons` in (a list of texts), `reasonsChange` out (the whole new list, in its new order). The
 * component never calls the backend. Order matters: cashiers see the reasons in the order set here.
 */
@Component({
  selector: 'app-void-reasons',
  standalone: true,
  imports: [ReactiveFormsModule, DragDropModule, TranslateModule, ReasonRowComponent, SuggestionChipsComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './void-reasons.component.html',
  styleUrl: './void-reasons.component.scss',
})
export class VoidReasonsComponent {
  private translate = inject(TranslateService);
  private announcer = inject(LiveAnnouncer);
  private toast = inject(ToastService);
  private injector = inject(Injector);
  private host = inject<ElementRef<HTMLElement>>(ElementRef);

  /** The reasons, in order. */
  reasons = input<readonly string[]>([]);
  reasonsChange = output<string[]>();

  readonly max = MAX_VOID_REASONS;
  readonly maxLength = MAX_VOID_REASON_LENGTH;

  /** Local working copy, with an id per reason for tracking and drag-drop. */
  items = signal<VoidReasonItem[]>([]);
  editingId = signal<string | null>(null);
  /** Error of the add field, once it has been submitted or touched (`required` is only shown after a submit). */
  error = signal<VoidReasonError | null>(null);

  atLimit = computed(() => this.items().length >= MAX_VOID_REASONS);
  isEmpty = computed(() => this.items().length === 0);
  labels = computed(() => this.items().map(i => i.label));

  /** The ready-made suggestions not yet in the list, while the list is short and not full. */
  suggestions = computed<string[]>(() => {
    if (this.items().length >= SUGGEST_BELOW || this.atLimit()) return [];
    this.langTick();
    const have = new Set(this.items().map(i => normalizeReason(i.label)));
    return SUGGESTION_KEYS
      .map(k => ({ key: 'SETTINGS.POS_OPTIONS.VOID.SUGGEST_' + k, text: this.translate.instant('SETTINGS.POS_OPTIONS.VOID.SUGGEST_' + k) as string }))
      // A text equal to its key means the translation isn't loaded yet: show nothing rather than the key.
      .filter(s => s.text && s.text !== s.key)
      .map(s => s.text)
      .filter(text => !have.has(normalizeReason(text)));
  });
  /** Bumped when the language changes, so suggestions re-translate. */
  private langTick = signal(0);

  /** The add field. Its validator reads the live list, so a duplicate is caught as the user types. */
  draft = new FormControl('', { nonNullable: true, validators: [reasonValidator(() => this.labels())] });
  private addField = viewChild<ElementRef<HTMLInputElement>>('addField');

  constructor() {
    // The suggestions are translated text: re-read them when the language changes AND when its texts finish loading
    // (the settings texts arrive after the first render; without this the keys themselves would show, and be added as reasons).
    merge(this.translate.onLangChange, this.translate.onTranslationChange, this.translate.onDefaultLangChange)
      .pipe(takeUntilDestroyed())
      .subscribe(() => this.langTick.update(n => n + 1));

    // Take the parent's list in. Skipped when it already equals the local one (the echo of our own `reasonsChange`).
    effect(() => {
      const incoming = this.reasons();
      untracked(() => {
        const current = this.items();
        if (incoming.length === current.length && incoming.every((l, i) => l === current[i].label)) return;
        // Keep the ids of reasons that are still there, so rows don't re-render / lose their edit state.
        const pool = [...current];
        this.items.set(incoming.map(label => {
          const at = pool.findIndex(c => c.label === label);
          return at >= 0 ? pool.splice(at, 1)[0] : { id: newReasonId(), label };
        }));
        this.editingId.set(null);
      });
    });

    // A full list takes no more input.
    effect(() => {
      if (this.atLimit()) this.draft.disable({ emitEvent: false });
      else if (this.draft.disabled) this.draft.enable({ emitEvent: false });
    });
  }

  // ── Adding ─────────────────────────────────────────────────────────────
  /** Text-field message key suffix for the current add error. */
  addErrorKey = computed(() => this.error());

  add(): void {
    this.draft.markAsTouched();
    const value = this.draft.value.trim();
    if (!value) { this.error.set(null); return; }
    if (this.draft.invalid) { this.error.set(Object.keys(this.draft.errors ?? {})[0] as VoidReasonError); return; }
    this.append(value);
    this.draft.reset('');
    this.error.set(null);
    this.focusAddField();
  }

  /** Typing clears a stale message and shows duplicate / length problems straight away (not "required" while the field is empty). */
  onDraftInput(): void {
    const e = this.draft.errors ? (Object.keys(this.draft.errors)[0] as VoidReasonError) : null;
    this.error.set(e && e !== 'required' ? e : null);
  }

  addSuggestion(text: string): void {
    if (this.atLimit()) return;
    this.append(text);
  }

  private append(label: string): void {
    this.items.update(list => [...list, { id: newReasonId(), label }]);
    this.emit();
    this.announce('SETTINGS.POS_OPTIONS.VOID.ANN_ADDED', { name: label });
  }

  private focusAddField(): void {
    afterNextRender(() => this.addField()?.nativeElement.focus(), { injector: this.injector });
  }

  // ── Editing ────────────────────────────────────────────────────────────
  startEdit(id: string): void { this.editingId.set(id); }
  cancelEdit(): void { this.editingId.set(null); }

  saveEdit(id: string, label: string): void {
    this.items.update(list => list.map(i => (i.id === id ? { ...i, label } : i)));
    this.editingId.set(null);
    this.emit();
    this.announce('SETTINGS.POS_OPTIONS.VOID.ANN_EDITED', { name: label });
  }

  /** The other reasons: what an edited text may not repeat. */
  takenFor(id: string): string[] {
    return this.items().filter(i => i.id !== id).map(i => i.label);
  }

  // ── Deleting (with undo) ───────────────────────────────────────────────
  remove(id: string): void {
    const list = this.items();
    const index = list.findIndex(i => i.id === id);
    if (index < 0) return;
    const removed = list[index];
    this.items.set(list.filter(i => i.id !== id));
    if (this.editingId() === id) this.editingId.set(null);
    this.emit();
    this.announce('SETTINGS.POS_OPTIONS.VOID.ANN_DELETED', { name: removed.label });
    this.toast.info('SETTINGS.POS_OPTIONS.VOID.REMOVED', removed.label, UNDO_MS, {
      label: 'SETTINGS.POS_OPTIONS.VOID.UNDO',
      run: () => this.restore(removed, index),
    });
  }

  /** Puts a removed reason back where it was (or last, if the list shrank). Skipped if the list is full or the text came back meanwhile. */
  private restore(item: VoidReasonItem, index: number): void {
    const list = this.items();
    if (list.length >= MAX_VOID_REASONS || list.some(i => normalizeReason(i.label) === normalizeReason(item.label))) return;
    const next = [...list];
    next.splice(Math.min(index, next.length), 0, item);
    this.items.set(next);
    this.emit();
    this.announce('SETTINGS.POS_OPTIONS.VOID.ANN_RESTORED', { name: item.label });
  }

  // ── Reordering ─────────────────────────────────────────────────────────
  drop(event: CdkDragDrop<VoidReasonItem[]>): void {
    if (event.previousIndex === event.currentIndex) return;
    const next = [...this.items()];
    moveItemInArray(next, event.previousIndex, event.currentIndex);
    this.items.set(next);
    this.emit();
    this.announce('SETTINGS.POS_OPTIONS.VOID.ANN_MOVED', { name: next[event.currentIndex].label, position: event.currentIndex + 1, total: next.length });
  }

  /** Keyboard reorder (Alt + Arrow on a row's handle). The handle keeps focus on the row that moved. */
  moveBy(id: string, delta: -1 | 1): void {
    const list = this.items();
    const from = list.findIndex(i => i.id === id);
    const to = from + delta;
    if (from < 0 || to < 0 || to >= list.length) return;
    const next = [...list];
    moveItemInArray(next, from, to);
    this.items.set(next);
    this.emit();
    this.announce('SETTINGS.POS_OPTIONS.VOID.ANN_MOVED', { name: next[to].label, position: to + 1, total: next.length });
    afterNextRender(() => {
      this.host.nativeElement.querySelector<HTMLElement>(`[data-id="${id}"] .rr__handle`)?.focus();
    }, { injector: this.injector });
  }

  // ── Helpers ────────────────────────────────────────────────────────────
  private emit(): void { this.reasonsChange.emit(this.labels()); }

  private announce(key: string, params: Record<string, unknown>): void {
    void this.announcer.announce(this.translate.instant(key, params), 'polite');
  }

  trackById = (_: number, item: VoidReasonItem): string => item.id;
}
