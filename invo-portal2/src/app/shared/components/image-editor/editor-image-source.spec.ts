import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { loadEditorImage } from './editor-image-source';
import { MediaRawError } from '../../../features/settings/media/services/media.service';

describe('loadEditorImage', () => {
  let created: string[];
  beforeEach(() => {
    created = [];
    vi.spyOn(URL, 'createObjectURL').mockImplementation(() => { const u = `blob:test/${created.length}`; created.push(u); return u; });
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  });
  afterEach(() => vi.restoreAllMocks());

  it('gives a same-origin blob copy and no issue when the backend delivers the file', async () => {
    const media = { getMediaRawBlob: vi.fn().mockResolvedValue(new Blob(['x'])) };
    const src = await loadEditorImage(media, 'm1', 'https://cdn/x.png', 'test');
    expect(src.url).toBe(created[0]);
    expect(src.objectUrl).toBe(created[0]);
    expect(src.issue).toBeNull();
  });

  it('falls back to the direct URL, keeps the real reason (route + status) and logs it, without throwing', async () => {
    const err = new MediaRawError([
      { route: 'raw', path: 'media/m1/raw', status: 404, message: 'Not Found' },
      { route: 'getMediabyId', path: 'media/getMediabyId/m1', status: 200, message: 'no inline file' },
    ]);
    const media = { getMediaRawBlob: vi.fn().mockRejectedValue(err) };
    const src = await loadEditorImage(media, 'm1', 'https://cdn/x.png', 'business-settings.cropLogo');
    expect(src.url).toBe('https://cdn/x.png');
    expect(src.objectUrl).toBeNull();
    expect(src.issue?.attempts[0]).toMatchObject({ route: 'raw', status: 404, path: 'media/m1/raw' });
    expect(src.issue?.summary).toContain('HTTP 404 on media/m1/raw');
    expect(console.warn).toHaveBeenCalledTimes(1);
    expect(String((console.warn as any).mock.calls[0][0])).toContain('business-settings.cropLogo');
  });

  it('still reports an issue for an unknown error (no attempts), naming the /raw route', async () => {
    const media = { getMediaRawBlob: vi.fn().mockRejectedValue(new Error('boom')) };
    const src = await loadEditorImage(media, 'm2', 'https://cdn/y.png', 't');
    expect(src.issue?.attempts[0]).toMatchObject({ route: 'raw', status: null, path: 'media/m2/raw' });
    expect(src.issue?.summary).toContain('no response on media/m2/raw');
  });

  it('uses the given URL as it is, with no request and no issue, when there is no media id', async () => {
    const media = { getMediaRawBlob: vi.fn() };
    const src = await loadEditorImage(media, null, 'https://cdn/z.png', 't');
    expect(src).toEqual({ url: 'https://cdn/z.png', objectUrl: null, issue: null });
    expect(media.getMediaRawBlob).not.toHaveBeenCalled();
  });
});
