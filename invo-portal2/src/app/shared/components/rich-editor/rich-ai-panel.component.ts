import { ChangeDetectionStrategy, Component, input, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AiRequest, AiTask } from './rich-editor-ai';

interface AiAction {
  id: string;
  label: string;
  icon: string;
  task: AiTask;
  /** Full natural-language instruction sent as the request prompt. */
  instruction: string;
}

/**
 * Content-AI assistant for the rich editor. Grouped quick actions
 * (Edit / Create content), a Change-tone submenu, and a free-form
 * "Tweak with prompt" field — then a streaming preview with Insert /
 * Replace / Discard. Pure UI: each action emits a complete instruction in
 * the request `prompt`, so the backend just needs prompt + content. The
 * editor owns the selection, runs the provider, and applies the result.
 */
@Component({
  selector: 'app-re-ai-panel',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="re-ai" (mousedown)="$event.stopPropagation()">
      <header class="re-ai__head" (mousedown)="headerPointerDown.emit($event)">
        <span class="re-ai__title">
          @if (view() === 'tone' && !hasResult()) {
            <button type="button" class="re-ai__back" (click)="view.set('menu')" aria-label="Back">
              <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
            </button>
            Change tone
          } @else {
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2l1.6 4.4L18 8l-4.4 1.6L12 14l-1.6-4.4L6 8l4.4-1.6L12 2z"/></svg>
            Content AI
          }
        </span>
        <button type="button" class="re-ai__close" (click)="close.emit()" aria-label="Close">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </header>

      @if (hasResult()) {
        <!-- ── Streaming preview + apply ── -->
        <div class="re-ai__preview" [class.is-busy]="busy()">{{ streaming() }}<span class="re-ai__caret" [hidden]="!busy()"></span></div>
        @if (error()) { <p class="re-ai__err">{{ error() }}</p> }
        <div class="re-ai__foot">
          @if (busy()) {
            <button type="button" class="re-ai__btn" (click)="stop.emit()">Stop</button>
          } @else {
            <button type="button" class="re-ai__btn re-ai__btn--primary" (click)="accept.emit('insert')">Insert</button>
            @if (hasSelection()) {
              <button type="button" class="re-ai__btn" (click)="accept.emit('replace')">Replace selection</button>
            }
            <button type="button" class="re-ai__btn" (click)="onDiscard()">Discard</button>
          }
        </div>
      } @else if (view() === 'tone') {
        <!-- ── Change-tone submenu ── -->
        <div class="re-ai__menu">
          @for (t of tones; track t) {
            <button type="button" class="re-ai__act" (click)="runTone(t)">
              <span class="re-ai__actIco">◓</span> {{ t }}
            </button>
          }
        </div>
      } @else {
        <!-- ── Action menu ── -->
        <div class="re-ai__menu">
          <div class="re-ai__group">Edit</div>
          @for (a of editActions; track a.id) {
            <button type="button" class="re-ai__act" (click)="runAction(a)">
              <span class="re-ai__actIco">{{ a.icon }}</span> {{ a.label }}
            </button>
          }
          <button type="button" class="re-ai__act" (click)="view.set('tone')">
            <span class="re-ai__actIco">◓</span> Change tone
            <svg class="re-ai__chev" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
          </button>

          <div class="re-ai__group">Create content</div>
          @for (a of createActions; track a.id) {
            <button type="button" class="re-ai__act" (click)="runAction(a)">
              <span class="re-ai__actIco">{{ a.icon }}</span> {{ a.label }}
            </button>
          }
        </div>
        <div class="re-ai__custom">
          <input type="text" class="re-ai__input" [(ngModel)]="custom"
                 placeholder="Tweak with prompt…" (keydown.enter)="runCustom()"/>
          <button type="button" class="re-ai__send" [disabled]="!custom().trim()" (click)="runCustom()" aria-label="Generate">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
          </button>
        </div>
      }
    </div>
  `,
  styles: [`
    :host { display: block; }
    .re-ai {
      width: 320px; background: #fff; border: 1px solid #e2e8f0; border-radius: 10px;
      box-shadow: 0 10px 30px rgba(0,0,0,.16); overflow: hidden; font-size: 13px; color: #1f2937;
    }
    .re-ai__head {
      display: flex; align-items: center; justify-content: space-between;
      padding: 9px 12px; border-bottom: 1px solid #eef2f6; cursor: grab; user-select: none;
    }
    .re-ai__title { display: inline-flex; align-items: center; gap: 6px; font-weight: 600; color: #0f172a; }
    .re-ai__title svg { color: #32acc1; }
    .re-ai__back { border: none; background: none; cursor: pointer; color: #64748b; display: inline-flex; padding: 0; margin-right: 2px; }
    .re-ai__back:hover { color: #0f172a; }
    .re-ai__close { border: none; background: none; cursor: pointer; color: #64748b; display: inline-flex; padding: 2px; border-radius: 4px; }
    .re-ai__close:hover { background: #f1f5f9; color: #0f172a; }
    .re-ai__menu { display: flex; flex-direction: column; padding: 6px; gap: 1px; max-height: 300px; overflow-y: auto; }
    .re-ai__group { padding: 8px 10px 4px; font-size: 11px; font-weight: 600; color: #94a3b8; text-transform: none; }
    .re-ai__act {
      display: flex; align-items: center; gap: 10px; width: 100%; text-align: left;
      padding: 8px 10px; border: none; background: none; border-radius: 6px;
      cursor: pointer; color: #1f2937; font-size: 13px;
    }
    .re-ai__act:hover:not(:disabled) { background: #ecf8fb; color: #2792a3; }
    .re-ai__act:disabled { opacity: .45; cursor: not-allowed; }
    .re-ai__actIco { width: 18px; text-align: center; color: #32acc1; font-size: 13px; flex: 0 0 auto; }
    .re-ai__chev { margin-left: auto; color: #cbd5e1; }
    .re-ai__custom { display: flex; gap: 6px; padding: 8px 10px 12px; border-top: 1px solid #eef2f6; }
    .re-ai__input {
      flex: 1; min-width: 0; padding: 7px 9px; border: 1px solid #d8e0e8; border-radius: 6px;
      font-size: 13px; outline: none;
    }
    .re-ai__input:focus { border-color: #32acc1; box-shadow: 0 0 0 2px rgba(50,172,193,.2); }
    .re-ai__send {
      flex: 0 0 auto; width: 34px; border: none; border-radius: 6px; background: #32acc1; color: #fff;
      cursor: pointer; display: inline-flex; align-items: center; justify-content: center;
    }
    .re-ai__send:disabled { opacity: .4; cursor: not-allowed; }
    .re-ai__preview {
      margin: 10px 12px; padding: 10px; max-height: 240px; overflow-y: auto;
      background: #f1fafc; border: 1px solid #d6eef3; border-radius: 6px;
      white-space: pre-wrap; line-height: 1.5; min-height: 40px;
    }
    .re-ai__caret { display: inline-block; width: 7px; height: 1.05em; vertical-align: text-bottom;
      background: #32acc1; margin-left: 1px; animation: re-ai-blink 1s steps(2) infinite; }
    @keyframes re-ai-blink { 0%,50% { opacity: 1 } 50.01%,100% { opacity: 0 } }
    .re-ai__err { margin: 0 12px 8px; color: #dc2626; font-size: 12px; }
    .re-ai__foot { display: flex; gap: 8px; padding: 0 12px 12px; }
    .re-ai__btn {
      padding: 7px 12px; border: 1px solid #d8e0e8; background: #fff; border-radius: 6px;
      cursor: pointer; font-size: 12px; color: #1f2937;
    }
    .re-ai__btn:hover { background: #f8fafc; }
    .re-ai__btn--primary { background: #32acc1; border-color: #32acc1; color: #fff; }
    .re-ai__btn--primary:hover { background: #2792a3; }
  `],
})
export class RichAiPanelComponent {
  /** Cumulative generated text streamed in by the editor. */
  streaming = input<string>('');
  /** True while a request is in flight (shows the typing caret + Stop). */
  busy = input<boolean>(false);
  /** Whether the editor currently has a non-empty text selection. */
  hasSelection = input<boolean>(false);
  /** Transport/provider error message, if any. */
  error = input<string | null>(null);

  run = output<AiRequest>();
  /** Apply the result: insert at the cursor, or replace the selection. */
  accept = output<'insert' | 'replace'>();
  /** Abort an in-flight request (keeps the partial text). */
  stop = output<void>();
  /** Clear the preview and return to the action menu. */
  discard = output<void>();
  close = output<void>();
  headerPointerDown = output<MouseEvent>();

  view = signal<'menu' | 'tone'>('menu');
  custom = signal('');

  /** Edit actions — adjust existing copy (act on the selection, or the
   *  whole post when nothing is selected). */
  readonly editActions: AiAction[] = [
    { id: 'improve',  label: 'Improve writing',        icon: '✦', task: 'improve', instruction: 'Improve the writing — clarity, flow and word choice — without changing the meaning.' },
    { id: 'rephrase', label: 'Rephrase',               icon: '↻', task: 'rewrite', instruction: 'Rephrase the text while preserving its meaning.' },
    { id: 'grammar',  label: 'Fix spelling & grammar', icon: '✓', task: 'custom',  instruction: 'Fix only the spelling and grammar mistakes. Keep the original wording and meaning.' },
    { id: 'shorten',  label: 'Shorten',                icon: '↧', task: 'custom',  instruction: 'Make the text shorter and more concise while keeping the key points.' },
    { id: 'expand',   label: 'Expand',                 icon: '↥', task: 'custom',  instruction: 'Expand the text with more detail and explanation, keeping the same tone.' },
  ];

  /** Create-content actions — generate new copy from the post context. */
  readonly createActions: AiAction[] = [
    { id: 'summarize', label: 'Summarize',         icon: '⊟', task: 'summarize', instruction: 'Summarize the text concisely.' },
    { id: 'heading',   label: 'Create a heading',  icon: 'H', task: 'custom',    instruction: 'Write one concise, compelling heading for this content. Return only the heading text.' },
    { id: 'continue',  label: 'Continue writing',  icon: '⤵', task: 'continue',  instruction: 'Continue writing naturally from where the text ends.' },
  ];

  readonly tones = ['Professional', 'Casual', 'Funny', 'Confident', 'Enthusiastic'];

  /** Preview shows once we have any streamed text or a request is running. */
  hasResult(): boolean { return this.busy() || !!this.streaming(); }

  runAction(a: AiAction): void { this.run.emit({ task: a.task, prompt: a.instruction }); }

  runTone(tone: string): void {
    this.run.emit({ task: 'custom', prompt: `Rewrite the text in a ${tone.toLowerCase()} tone, keeping the meaning.` });
  }

  runCustom(): void {
    const prompt = this.custom().trim();
    if (!prompt) return;
    this.run.emit({ task: 'custom', prompt });
  }

  onDiscard(): void {
    this.view.set('menu');
    this.discard.emit();
  }
}
