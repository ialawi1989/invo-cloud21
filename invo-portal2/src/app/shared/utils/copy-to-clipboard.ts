/**
 * Copies `text` to the clipboard and reports whether it worked.
 *
 * The async Clipboard API needs a secure context, document focus and a permissions policy that
 * allows it, so it can fail silently (e.g. inside a modal focus trap or an embedded builder). The
 * fallback uses a hidden textarea and `execCommand('copy')`; pass `host` (an element inside the
 * open dialog) so the textarea lives within the focus trap and can actually take focus.
 */
export async function copyToClipboard(text: string, host?: HTMLElement | null): Promise<boolean> {
  if (!text) return false;
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch { /* fall through to the textarea fallback */ }

  const parent = host ?? document.body;
  const previous = document.activeElement as HTMLElement | null;
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.setAttribute('readonly', '');
  ta.style.cssText = 'position:fixed;top:0;left:0;opacity:0;pointer-events:none';
  parent.appendChild(ta);
  try {
    ta.focus();
    ta.select();
    ta.setSelectionRange(0, text.length);
    return document.execCommand('copy');
  } catch {
    return false;
  } finally {
    parent.removeChild(ta);
    previous?.focus?.();
  }
}
