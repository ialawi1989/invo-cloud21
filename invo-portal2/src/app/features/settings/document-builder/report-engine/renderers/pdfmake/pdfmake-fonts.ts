/**
 * pdfmake font registration — Arabic support via Amiri.
 *
 * pdfmake's bundled VFS only ships Roboto (no Arabic glyphs). To render
 * Arabic, we fetch the Amiri TTFs served from `public/fonts/` (see
 * angular.json `assets`), base64-encode them into pdfmake's VFS, and
 * declare an `Amiri` family in `pdfMake.fonts` so the renderer can opt into
 * it per-block via `font: 'Amiri'`.
 *
 * Amiri is licensed under SIL OFL 1.1 — bundling/redistribution is
 * permitted (https://github.com/aliftype/amiri).
 *
 * Notes:
 *  - pdfkit (under pdfmake) needs raw TTF, not WOFF/WOFF2.
 *  - Amiri has no italic; we map italics to the regular cut so styles
 *    don't fall through to a missing key and crash createPdf.
 *  - The fetch happens once per page-load; subsequent exports reuse the
 *    populated VFS. Wrapped in a promise cache so concurrent exports
 *    don't double-fetch.
 */

interface PdfMakeLike {
  vfs: Record<string, string>;
  fonts?: Record<string, {
    normal: string;
    bold: string;
    italics: string;
    bolditalics: string;
  }>;
}

const ARABIC_FONT_FILES = {
  'Amiri-Regular.ttf': 'assets/fonts/Amiri/Amiri-Regular.ttf',
  'Amiri-Bold.ttf': 'assets/fonts/Amiri/Amiri-Bold.ttf',
} as const;

let registrationPromise: Promise<void> | undefined;

export async function registerArabicFont(pdfMake: PdfMakeLike): Promise<void> {
  if (pdfMake.vfs?.['Amiri-Regular.ttf']) return;
  registrationPromise ??= (async () => {
    const entries = await Promise.all(
      Object.entries(ARABIC_FONT_FILES).map(async ([key, url]) => {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`Failed to load ${url}: ${res.status}`);
        const buf = await res.arrayBuffer();
        return [key, arrayBufferToBase64(buf)] as const;
      }),
    );
    for (const [key, b64] of entries) pdfMake.vfs[key] = b64;
    pdfMake.fonts = {
      // Preserve pdfmake's default Roboto definition — overwriting the
      // whole map would strip it and break Latin-only documents.
      ...(pdfMake.fonts ?? {
        Roboto: {
          normal: 'Roboto-Regular.ttf',
          bold: 'Roboto-Medium.ttf',
          italics: 'Roboto-Italic.ttf',
          bolditalics: 'Roboto-MediumItalic.ttf',
        },
      }),
      Amiri: {
        normal: 'Amiri-Regular.ttf',
        bold: 'Amiri-Bold.ttf',
        italics: 'Amiri-Regular.ttf',
        bolditalics: 'Amiri-Bold.ttf',
      },
    };
  })();
  return registrationPromise;
}

/**
 * ArrayBuffer → base64. Browsers don't expose a direct API; chunked
 * String.fromCharCode avoids "Maximum call stack size exceeded" on the
 * ~430KB Amiri files.
 */
function arrayBufferToBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  const CHUNK = 0x8000;
  let binary = '';
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK) as unknown as number[]);
  }
  return btoa(binary);
}
