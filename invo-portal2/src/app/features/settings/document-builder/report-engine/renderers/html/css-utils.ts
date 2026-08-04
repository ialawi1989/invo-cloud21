import { BlockStyle, BorderSide, FontStyle, SpacingBox } from '../../core/types/style.types';

const escapeHtmlMap: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (c) => escapeHtmlMap[c]);
}

/** Limited HTML sanitizer — allows only formatting tags. */
const ALLOWED_TAGS = new Set(['b', 'strong', 'i', 'em', 'u', 'br', 'span', 'ul', 'ol', 'li', 'p']);
export function sanitizeRichText(html: string): string {
  // Strip tags not in allow-list. We use a regex pass for portability;
  // for stricter requirements swap in DOMPurify at the integration layer.
  return html.replace(/<\/?([a-zA-Z][a-zA-Z0-9]*)([^>]*)>/g, (full, tag) => {
    if (ALLOWED_TAGS.has(String(tag).toLowerCase())) {
      // Strip attributes for safety.
      const isClosing = full.startsWith('</');
      return `<${isClosing ? '/' : ''}${String(tag).toLowerCase()}>`;
    }
    return '';
  });
}

export function fontStyleToCss(font: FontStyle | undefined): string {
  if (!font) return '';
  const parts: string[] = [];
  if (font.family) parts.push(`font-family: ${font.family}`);
  if (font.size !== undefined) parts.push(`font-size: ${font.size}pt`);
  if (font.weight !== undefined) parts.push(`font-weight: ${font.weight}`);
  if (font.italic) parts.push('font-style: italic');
  const decorations: string[] = [];
  if (font.underline) decorations.push('underline');
  if (font.strikeThrough) decorations.push('line-through');
  if (decorations.length) parts.push(`text-decoration: ${decorations.join(' ')}`);
  if (font.letterSpacing !== undefined) parts.push(`letter-spacing: ${font.letterSpacing}px`);
  if (font.lineHeight !== undefined) parts.push(`line-height: ${font.lineHeight}`);
  if (font.color) parts.push(`color: ${font.color}`);
  return parts.join('; ');
}

function spacingToCss(prop: 'padding' | 'margin', box: SpacingBox | undefined): string {
  if (!box) return '';
  const t = box.top ?? 0;
  const r = box.right ?? 0;
  const b = box.bottom ?? 0;
  const l = box.left ?? 0;
  return `${prop}: ${t}mm ${r}mm ${b}mm ${l}mm`;
}

function borderSideToCss(prop: string, side: BorderSide | undefined): string {
  if (!side) return '';
  return `${prop}: ${side.width}pt ${side.style} ${side.color}`;
}

export function blockStyleToCss(style: BlockStyle | undefined): string {
  if (!style) return '';
  const parts: string[] = [];
  parts.push(fontStyleToCss(style.font));
  if (style.background) parts.push(`background: ${style.background}`);
  parts.push(spacingToCss('padding', style.padding));
  parts.push(spacingToCss('margin', style.margin));
  if (style.border) {
    parts.push(borderSideToCss('border-top', style.border.top));
    parts.push(borderSideToCss('border-right', style.border.right));
    parts.push(borderSideToCss('border-bottom', style.border.bottom));
    parts.push(borderSideToCss('border-left', style.border.left));
  }
  if (style.align) parts.push(`text-align: ${style.align}`);
  if (style.vAlign) {
    const map: Record<string, string> = { top: 'flex-start', middle: 'center', bottom: 'flex-end' };
    parts.push(`display: flex; flex-direction: column; justify-content: ${map[style.vAlign]}`);
  }
  if (style.direction) parts.push(`direction: ${style.direction}`);
  if (style.opacity !== undefined) parts.push(`opacity: ${style.opacity}`);
  if (style.rotate) parts.push(`transform: rotate(${style.rotate}deg)`);
  return parts.filter(Boolean).join('; ');
}

/** Combine multiple style fragments, later ones winning. */
export function mergeCss(...fragments: string[]): string {
  return fragments.filter(Boolean).join('; ');
}
