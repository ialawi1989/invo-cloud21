import { InjectionToken, Signal } from '@angular/core';
import { Observable } from 'rxjs';

/** Preset Content-AI actions + a free-form custom instruction. */
export type AiTask = 'improve' | 'rewrite' | 'summarize' | 'continue' | 'custom';

export interface AiRequest {
  task: AiTask;
  /** User instruction (for `custom`); empty for preset tasks. */
  prompt: string;
  /** Context: the selected text, or the whole post when nothing is selected. */
  content?: string;
}

/**
 * A host supplies this so the rich editor can run Content AI. The editor
 * injects it as an OPTIONAL dependency, so AI features only light up where a
 * provider is actually given (e.g. the blog post-composer) — the shared
 * editor itself stays provider-agnostic and AI-free everywhere else.
 */
export interface RichEditorAiProvider {
  /**
   * Run a request and stream the result back. Each emission is the FULL text
   * generated so far (cumulative), so the panel can bind it directly. Completes
   * when generation finishes; errors on transport/provider failure.
   */
  generate(req: AiRequest): Observable<string>;

  /**
   * Optional readiness signal. When provided and `false`, the editor
   * disables the Content AI button (the company hasn't enabled/keyed
   * Content AI yet) and shows a tooltip pointing to Plugins → Content AI.
   * Omit to keep the button always enabled.
   */
  available?: Signal<boolean>;
}

export const RICH_EDITOR_AI_PROVIDER =
  new InjectionToken<RichEditorAiProvider>('RICH_EDITOR_AI_PROVIDER');
