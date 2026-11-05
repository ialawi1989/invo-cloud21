import { ChangeDetectionStrategy, Component, ElementRef, effect, inject, viewChild } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

import { AssistantService } from './assistant.service';
import { AssistantLink } from './assistant.types';

/**
 * Floating chat button + slide-in panel for the dashboard. It looks things up for the employee (through the portal's
 * authorized services) and offers buttons that open pages; it never saves or changes a document.
 */
@Component({
  selector: 'app-ai-assistant',
  standalone: true,
  imports: [FormsModule, DecimalPipe, TranslateModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (open()) {
      <section class="as-panel" role="dialog" [attr.aria-label]="'ASSISTANT.TITLE' | translate">
        <header class="as-head">
          <strong>{{ 'ASSISTANT.TITLE' | translate }}</strong>
          <span class="as-head__sp"></span>
          @if (chat.items().length) {
            <button type="button" class="as-icon" (click)="chat.reset()" [title]="'ASSISTANT.NEW_CHAT' | translate">⟲</button>
          }
          <button type="button" class="as-icon" (click)="open.set(false)" [attr.aria-label]="'COMMON.CLOSE' | translate">✕</button>
        </header>

        <div class="as-body" #body>
          @if (!chat.items().length) {
            <div class="as-empty">
              <p>{{ 'ASSISTANT.WELCOME' | translate }}</p>
              @for (s of suggestions; track s) {
                <button type="button" class="as-chip" (click)="ask(s)">{{ s | translate }}</button>
              }
            </div>
          }
          @for (m of chat.items(); track m.id) {
            <div class="as-msg" [class.as-msg--user]="m.role === 'user'" [class.as-msg--err]="m.error">
              <div class="as-bubble">{{ m.key ? (m.key | translate) : m.text }}</div>
              @if (m.links?.length) {
                <div class="as-links">
                  @for (l of m.links; track l.url) {
                    <button type="button" class="as-link" (click)="go(l)">{{ l.label }} ›</button>
                  }
                </div>
              }
            </div>
          }
          @if (chat.busy()) { <div class="as-msg"><div class="as-bubble as-typing">…</div></div> }
        </div>

        <form class="as-input" (ngSubmit)="submit()">
          <input type="text" name="q" autocomplete="off" maxlength="2000" [(ngModel)]="draft"
                 [placeholder]="'ASSISTANT.PLACEHOLDER' | translate"/>
          @if (chat.busy()) {
            <button type="button" class="as-send" (click)="chat.stop()">■</button>
          } @else {
            <button type="submit" class="as-send" [disabled]="!draft.trim()">➤</button>
          }
        </form>
        @if (chat.usagePct(); as pct) {
          <div class="as-usage" [class.is-hot]="pct >= 80">
            <span>{{ 'ASSISTANT.USAGE_PCT' | translate: { pct: pct } }}</span>
            <span class="as-usage__bar"><i [style.width.%]="pct"></i></span>
          </div>
        }
        <small class="as-foot">
          @if (chat.usageToday(); as u) {
            {{ 'ASSISTANT.USAGE_TODAY' | translate: { requests: (u.requests | number), tokens: (u.tokens | number) } }} ·
          }
          {{ 'ASSISTANT.FOOTNOTE' | translate }}
        </small>
      </section>
    }
  `,
  styles: [`
    /* Opened from the top bar's assistant button; sits just under the bar, on every page. */
    :host { position: fixed; top: 64px; inset-inline-end: 16px; z-index: 1100; }
    .as-panel { width: min(400px, calc(100vw - 24px)); height: min(560px, calc(100vh - 88px)); background: #fff; border: 1px solid #e2e8f0;
      border-radius: 14px; box-shadow: 0 12px 40px rgba(15,23,42,.22); display: flex; flex-direction: column; overflow: hidden; }
    .as-head { display: flex; align-items: center; gap: 6px; padding: 12px 14px; background: #2691a4; color: #fff; }
    .as-head__sp { flex: 1; }
    .as-icon { background: transparent; border: 0; color: #fff; cursor: pointer; font-size: 16px; padding: 4px 6px; border-radius: 6px; }
    .as-icon:hover { background: rgba(255,255,255,.18); }
    .as-body { flex: 1; overflow-y: auto; padding: 14px; display: flex; flex-direction: column; gap: 10px; background: #f8fafc; }
    .as-empty { color: #475569; font-size: 13.5px; display: flex; flex-direction: column; gap: 8px; align-items: flex-start; }
    .as-empty p { margin: 0 0 4px; }
    .as-chip { border: 1px solid #cbd5e1; background: #fff; border-radius: 999px; padding: 6px 12px; font-size: 12.5px; cursor: pointer; color: #334155; text-align: start; }
    .as-chip:hover { border-color: #2691a4; color: #2691a4; }
    .as-msg { display: flex; flex-direction: column; gap: 6px; align-items: flex-start; }
    .as-msg--user { align-items: flex-end; }
    .as-bubble { max-width: 90%; padding: 9px 12px; border-radius: 12px; background: #fff; border: 1px solid #e2e8f0; font-size: 13.5px;
      color: #0f172a; white-space: pre-wrap; word-break: break-word; line-height: 1.45; }
    .as-msg--user .as-bubble { background: #2691a4; border-color: #2691a4; color: #fff; }
    .as-msg--err .as-bubble { background: #fef2f2; border-color: #fecaca; color: #991b1b; }
    .as-typing { color: #94a3b8; letter-spacing: 2px; }
    .as-links { display: flex; flex-wrap: wrap; gap: 6px; }
    .as-link { border: 1px solid #2691a4; color: #2691a4; background: #fff; border-radius: 8px; padding: 4px 10px; font-size: 12.5px; cursor: pointer; font-weight: 600; }
    .as-link:hover { background: #ecf7f9; }
    .as-input { display: flex; gap: 8px; padding: 10px 12px 4px; border-top: 1px solid #e2e8f0; }
    .as-input input { flex: 1; height: 38px; border: 1px solid #d0d5dd; border-radius: 10px; padding: 0 12px; font: inherit; font-size: 13.5px; }
    .as-input input:focus { outline: none; border-color: #2691a4; }
    .as-send { width: 38px; height: 38px; border-radius: 10px; border: 0; background: #2691a4; color: #fff; cursor: pointer; }
    .as-send:disabled { opacity: .45; cursor: not-allowed; }
    .as-usage { display: flex; align-items: center; gap: 8px; padding: 0 14px 4px; font-size: 11.5px; font-weight: 600; color: #475569; }
    .as-usage__bar { flex: 1; height: 5px; border-radius: 999px; background: #e2e8f0; overflow: hidden; }
    .as-usage__bar i { display: block; height: 100%; background: #2691a4; }
    .as-usage.is-hot { color: #b91c1c; }
    .as-usage.is-hot i { background: #dc2626; }
    .as-foot { padding: 0 14px 10px; color: #94a3b8; font-size: 11px; }
  `],
})
export class AssistantPanelComponent {
  readonly chat = inject(AssistantService);
  private router = inject(Router);
  private translate = inject(TranslateService);

  /** Shared with the top bar button. */
  readonly open = this.chat.open;
  draft = '';
  private readonly body = viewChild<ElementRef<HTMLElement>>('body');

  readonly suggestions = ['ASSISTANT.SUGGEST_1', 'ASSISTANT.SUGGEST_2', 'ASSISTANT.SUGGEST_3'];

  constructor() {
    // Keep the newest message in view.
    effect(() => {
      this.chat.items();
      this.chat.busy();
      queueMicrotask(() => { const el = this.body()?.nativeElement; if (el) el.scrollTop = el.scrollHeight; });
    });
  }

  /** A suggestion is sent as the translated text the user sees on the chip. */
  ask(key: string): void { void this.chat.send(this.translate.instant(key)); }
  submit(): void { const q = this.draft; this.draft = ''; void this.chat.send(q); }
  go(l: AssistantLink): void { void this.router.navigateByUrl(l.url); }
}
