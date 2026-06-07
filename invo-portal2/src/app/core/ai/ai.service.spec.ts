import { TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach, vi } from 'vitest';

import { AiService } from './ai.service';
import { ApiService } from '@core/http';
import { AuthService } from '@core/auth/auth.service';

/**
 * Two behaviours the Content AI contract is strict about:
 *   1. Saving settings with an empty/blank API key must PRESERVE the
 *      stored key — i.e. the POST body must omit `apiKey` entirely.
 *   2. The streaming generate happy-path parses SSE `data:` frames into
 *      incremental deltas and resolves cleanly on `data: [DONE]`.
 */
describe('AiService', () => {
  let api: { get: ReturnType<typeof vi.fn>; post: ReturnType<typeof vi.fn>; request: ReturnType<typeof vi.fn> };
  let auth: { getAccessToken: ReturnType<typeof vi.fn> };
  let service: AiService;

  beforeEach(() => {
    api = { get: vi.fn(), post: vi.fn(), request: vi.fn() };
    auth = { getAccessToken: vi.fn(() => 'tok-123') };

    TestBed.configureTestingModule({
      providers: [
        AiService,
        { provide: ApiService, useValue: api },
        { provide: AuthService, useValue: auth },
      ],
    });
    service = TestBed.inject(AiService);
  });

  describe('saveCompanySettings — masked key preservation', () => {
    it('omits apiKey from the POST body when blank (keeps stored key)', async () => {
      // `post` just builds the request descriptor; capture its body.
      api.post.mockReturnValue({});
      api.request.mockResolvedValue({
        success: true,
        data: { enabled: true, provider: 'deepseek', baseUrl: 'u', model: 'm', apiKeySet: true },
      });

      await service.saveCompanySettings({
        provider: 'deepseek', baseUrl: 'u', model: 'm', apiKey: '   ', enabled: true,
      });

      expect(api.post).toHaveBeenCalledTimes(1);
      const body = api.post.mock.calls[0][1];
      expect('apiKey' in body).toBe(false);
      expect(body.provider).toBe('deepseek');
    });

    it('includes apiKey when the user typed a new one', async () => {
      api.post.mockReturnValue({});
      api.request.mockResolvedValue({
        success: true,
        data: { enabled: true, provider: 'openai', baseUrl: 'u', model: 'm', apiKeySet: true },
      });

      await service.saveCompanySettings({
        provider: 'openai', baseUrl: 'u', model: 'm', apiKey: 'sk-new', enabled: true,
      });

      const body = api.post.mock.calls[0][1];
      expect(body.apiKey).toBe('sk-new');
    });
  });

  describe('generateStream — SSE happy path', () => {
    it('emits each delta and resolves on [DONE]', async () => {
      mockFetchStream([
        'data: {"text":"Hello"}\n\n',
        'data: {"text":", world"}\n\n',
        'data: [DONE]\n\n',
      ]);

      const deltas: string[] = [];
      await service.generateStream(
        { task: 'improve', prompt: '', content: 'hi' },
        (d) => deltas.push(d),
      );

      expect(deltas).toEqual(['Hello', ', world']);
    });

    it('throws a mapped AiError on an `event: error` frame', async () => {
      mockFetchStream(['event: error\ndata: {"code":"AI_RATE_LIMITED","message":"slow down"}\n\n']);

      await expect(
        service.generateStream({ task: 'custom', prompt: 'x' }, () => {}),
      ).rejects.toMatchObject({ code: 'AI_RATE_LIMITED' });
    });
  });

  // ── helpers ─────────────────────────────────────────────────────────
  /** Replace global fetch with one that streams the given UTF-8 frames. */
  function mockFetchStream(frames: string[]): void {
    const encoder = new TextEncoder();
    let i = 0;
    const reader = {
      read: () =>
        Promise.resolve(
          i < frames.length
            ? { done: false, value: encoder.encode(frames[i++]) }
            : { done: true, value: undefined },
        ),
      releaseLock: () => {},
      cancel: () => Promise.resolve(),
    };
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      body: { getReader: () => reader },
      headers: new Headers(),
      json: () => Promise.resolve({}),
    } as unknown as Response);
  }
});
