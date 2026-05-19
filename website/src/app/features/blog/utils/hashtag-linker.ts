/**
 * Auto-link #hashtags inside rendered HTML. Walks text nodes only so
 * we never inject anchors into existing markup (image alt text,
 * attribute values, etc.). DOMParser is used in the browser; on the
 * server we get the same result via the regex-only fallback.
 */

const HASHTAG_RE = /#([\p{L}\p{N}_]+)/gu;

export function linkifyHashtags(html: string, lang: string): string {
  if (!html) return html;

  if (typeof DOMParser !== 'undefined') {
    const doc = new DOMParser().parseFromString(`<root>${html}</root>`, 'text/html');
    const root = doc.body.firstElementChild!;
    walk(root, lang);
    return root.innerHTML;
  }

  // SSR fallback — replace hashtags everywhere except inside tags.
  // Simple state machine, good enough for trusted CMS HTML.
  let out = '';
  let inTag = false;
  let buf = '';
  const flush = () => {
    if (!inTag && buf) {
      out += buf.replace(HASHTAG_RE, (_m, tag) => anchorFor(lang, tag));
      buf = '';
    } else if (inTag) {
      out += buf;
      buf = '';
    }
  };
  for (const ch of html) {
    if (ch === '<') { flush(); inTag = true; buf = ch; }
    else if (ch === '>') { buf += ch; flush(); inTag = false; }
    else buf += ch;
  }
  flush();
  return out;
}

function walk(node: Element, lang: string): void {
  const children = Array.from(node.childNodes);
  for (const child of children) {
    if (child.nodeType === 3 /* TEXT_NODE */) {
      const text = child.textContent ?? '';
      if (!HASHTAG_RE.test(text)) { HASHTAG_RE.lastIndex = 0; continue; }
      HASHTAG_RE.lastIndex = 0;
      const frag = document.createDocumentFragment();
      let last = 0;
      let m: RegExpExecArray | null;
      while ((m = HASHTAG_RE.exec(text)) !== null) {
        if (m.index > last) frag.appendChild(document.createTextNode(text.slice(last, m.index)));
        const a = document.createElement('a');
        a.setAttribute('href', `/${lang}/blog/tag/${encodeURIComponent(m[1])}`);
        a.className = 'blog-hashtag';
        a.textContent = `#${m[1]}`;
        frag.appendChild(a);
        last = m.index + m[0].length;
      }
      if (last < text.length) frag.appendChild(document.createTextNode(text.slice(last)));
      child.parentNode!.replaceChild(frag, child);
    } else if (child.nodeType === 1 /* ELEMENT_NODE */) {
      const tag = (child as Element).tagName.toLowerCase();
      if (tag === 'a' || tag === 'code' || tag === 'pre' || tag === 'script' || tag === 'style') continue;
      walk(child as Element, lang);
    }
  }
}

function anchorFor(lang: string, tag: string): string {
  const safe = tag.replace(/"/g, '&quot;');
  return `<a class="blog-hashtag" href="/${lang}/blog/tag/${encodeURIComponent(tag)}">#${safe}</a>`;
}
