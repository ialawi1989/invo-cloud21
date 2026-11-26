import type { MediaLoadAttempt } from '../../../features/settings/media/services/media.service';

/** Why the editor could not be given a same-origin copy of an image (so it has only the direct storage address). */
export interface EditorSourceIssue {
  /** What each route answered, in the order they were tried. */
  attempts: MediaLoadAttempt[];
  /** One line for people and logs: "HTTP 404 on media/<id>/raw; HTTP 500 on media/getMediabyId/<id>". */
  summary: string;
}

/** What to open the photo editor with. */
export interface EditorImageSource {
  /** The image address: a same-origin `blob:` copy when loading worked, otherwise the direct storage URL. */
  url: string;
  /** The `blob:` URL created here (revoke it when the editor closes), or null when `url` is the direct address. */
  objectUrl: string | null;
  /** Set when the copy could not be loaded and `url` is the direct address (export may then be blocked by CORS). */
  issue: EditorSourceIssue | null;
}

/** The part of MediaService the loader needs (kept narrow so it is easy to fake). */
export interface RawBlobLoader {
  getMediaRawBlob(mediaId: string): Promise<Blob>;
}

/**
 * Gets an image ready for the photo editor, the same way for every caller:
 *  1. a library item is fetched through the authenticated backend (`media/:id/raw`, then the inline `getMediabyId`),
 *     which gives a same-origin `blob:` copy the canvas can export;
 *  2. if that fails, the direct URL is used so the picture still shows, and the real reason is logged and returned.
 *
 * It never throws: callers open the editor either way.
 */
export async function loadEditorImage(
  media: RawBlobLoader,
  mediaId: string | null | undefined,
  fallbackUrl: string | null | undefined,
  /** Who is asking, for the console line (e.g. 'business-settings.cropLogo'). */
  caller: string,
): Promise<EditorImageSource> {
  const direct = fallbackUrl ?? '';
  if (!mediaId) return { url: direct, objectUrl: null, issue: null };
  try {
    const objectUrl = URL.createObjectURL(await media.getMediaRawBlob(mediaId));
    return { url: objectUrl, objectUrl, issue: null };
  } catch (e) {
    const attempts: MediaLoadAttempt[] = (e as { attempts?: MediaLoadAttempt[] })?.attempts
      ?? [{ route: 'raw', path: `media/${mediaId}/raw`, status: null, message: e instanceof Error ? e.message : String(e) }];
    const summary = attempts.map(a => `${a.status ? 'HTTP ' + a.status : 'no response'} on ${a.path}`).join('; ');
    console.warn(`[photo-editor] ${caller}: could not load a copy of media ${mediaId}; using the direct URL (export may be blocked)`, {
      attempts,
      directUrl: direct || null,
    });
    return { url: direct, objectUrl: null, issue: { attempts, summary } };
  }
}
