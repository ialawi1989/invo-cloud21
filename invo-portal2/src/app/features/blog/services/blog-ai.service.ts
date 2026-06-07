import { Injectable, Signal, inject, signal } from '@angular/core';
import { Observable } from 'rxjs';
import { TranslateService } from '@ngx-translate/core';

import { AiService } from '@core/ai/ai.service';
import { AiError, AiTask, aiErrorI18nKey } from '@core/ai/ai.types';
import { LanguageService } from '@core/i18n/language.service';
import { AiRequest, RichEditorAiProvider } from '@shared/components/rich-editor/rich-editor-ai';

/**
 * Blog implementation of the rich editor's Content-AI provider. Delegates
 * to the shared `AiService.generateStream` (SSE over fetch) so the
 * api-auth header, error-code mapping, and `event: error` parsing live
 * in one place. The provider API key is server-side only — never seen here.
 *
 * Provided at the blog post-composer level so AI is scoped to the blog:
 * editors that don't supply RICH_EDITOR_AI_PROVIDER show no AI button.
 *
 * Exposes `available` — false until the company has configured + enabled
 * Content AI (Plugins → Content AI) — so the editor can disable the
 * button with a helpful tooltip instead of failing on first use.
 */
@Injectable()
export class BlogAiService implements RichEditorAiProvider {
  private readonly ai = inject(AiService);
  private readonly translate = inject(TranslateService);
  private readonly lang = inject(LanguageService);

  private readonly _available = signal(false);
  /** True once the company-level Content AI plugin is enabled + keyed. */
  readonly available: Signal<boolean> = this._available.asReadonly();

  constructor() {
    // The AI tooltip + error strings live in the `plugins` namespace.
    void this.lang.loadFeature('settings/plugins');
    void this.refreshAvailability();
  }

  /** Re-check the company Content AI status (enabled + key stored). */
  async refreshAvailability(): Promise<void> {
    try {
      const s = await this.ai.getCompanySettings();
      this._available.set(s.enabled && s.apiKeySet);
    } catch {
      this._available.set(false);
    }
  }

  generate(req: AiRequest): Observable<string> {
    return new Observable<string>((subscriber) => {
      const controller = new AbortController();
      let full = '';

      this.ai.generateStream(
        { task: req.task as AiTask, prompt: req.prompt ?? '', content: req.content },
        (delta) => { full += delta; subscriber.next(full); },
        controller.signal,
      )
        .then(() => subscriber.complete())
        .catch((err) => {
          if (controller.signal.aborted) return;
          subscriber.error(this.toFriendly(err));
        });

      // Teardown — aborts the upstream request on unsubscribe (cancel).
      return () => controller.abort();
    });
  }

  /** Map an AiError code to a translated, user-facing message. */
  private toFriendly(err: unknown): Error {
    if (err instanceof AiError) {
      return new Error(this.translate.instant(aiErrorI18nKey(err.code)));
    }
    return new Error(this.translate.instant('PLUGINS.AI.ERR_GENERIC'));
  }
}
