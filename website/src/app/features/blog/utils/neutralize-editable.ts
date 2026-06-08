/**
 * Strip editing affordances from stored rich-editor HTML so the public
 * storefront renders post content strictly read-only.
 *
 * The dashboard editor can leave `contenteditable` regions and live form
 * controls (text inputs, textareas, selects) in the saved markup — on the
 * storefront nothing should be typeable or editable. We neutralise them
 * here rather than relying on CSS so keyboard interaction is blocked too.
 *
 * Pure string transform → safe on the SSR server (no DOM) and in the
 * browser. Runs before the content is trusted for innerHTML.
 */
export function neutralizeEditable(html: string): string {
  if (!html) return html;
  return html
    // Any `contenteditable` (true / empty / bare) → not editable.
    .replace(/\scontenteditable(\s*=\s*("[^"]*"|'[^']*'|[^\s>]+))?/gi, ' contenteditable="false"')
    // Text inputs & textareas → readonly + disabled (no typing/focus).
    .replace(/<(input|textarea)\b/gi, '<$1 readonly disabled')
    // Selects can't be readonly — disable them.
    .replace(/<select\b/gi, '<select disabled')
    // Drop editor drag handles.
    .replace(/\sdraggable\s*=\s*("true"|'true'|true)/gi, '');
}
