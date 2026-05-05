/** A single colour stop in a multi-stop linear gradient. */
export interface GradientStop {
  /** Canonical `#RRGGBB` (uppercase). */
  color:    string;
  /** 0..100, representing the percentage along the gradient axis. */
  position: number;
}

/** Direction the gradient flows along. Plain `<deg>` is supported via
 *  the `angle` field for full control; `'to right'` etc. are the four
 *  compass shortcuts the picker surfaces in its UI. */
export interface GradientValue {
  direction: 'to right' | 'to left' | 'to bottom' | 'to top' | 'angle';
  /** Used only when `direction === 'angle'`. 0..360. */
  angle?: number;
  stops: GradientStop[];
}

/**
 * Render a `GradientValue` to a CSS `linear-gradient(...)` string —
 * the same string you'd paste into `background-image`.
 */
export function gradientToCss(g: GradientValue): string {
  if (!g || !g.stops || g.stops.length === 0) return '';
  // Stops MUST be in ascending position order on the wire — most CSS
  // engines tolerate disorder but the picker UI assumes sorted stops
  // for its drag-thumb math.
  const sorted = [...g.stops].sort((a, b) => a.position - b.position);
  const stops = sorted.map((s) => `${s.color} ${s.position}%`).join(', ');
  const dir = g.direction === 'angle'
    ? `${Math.round(g.angle ?? 90)}deg`
    : g.direction;
  return `linear-gradient(${dir}, ${stops})`;
}

/**
 * Best-effort parse of a CSS `linear-gradient(...)` string into a
 * `GradientValue`. Handles the shapes the picker emits (compass
 * directions or `<deg>` + `#RRGGBB <position>%` stops) plus a couple
 * of common variants. Returns `null` if the string isn't recognisable
 * — callers should fall back to a default gradient.
 */
export function parseGradient(css: string): GradientValue | null {
  if (!css) return null;
  const m = /^\s*linear-gradient\(\s*([^,]+),\s*(.+)\)\s*$/i.exec(css);
  if (!m) return null;

  const head = m[1].trim();
  let direction: GradientValue['direction'] = 'to right';
  let angle: number | undefined;
  if (/^to\s+(right|left|top|bottom)$/i.test(head)) {
    direction = ('to ' + head.split(/\s+/)[1].toLowerCase()) as GradientValue['direction'];
  } else if (/^-?\d+(\.\d+)?\s*deg$/i.test(head)) {
    direction = 'angle';
    angle = parseFloat(head);
  }

  const stops: GradientStop[] = [];
  // Split on commas that aren't inside parentheses (rgb(...), etc.).
  const parts = splitTopLevel(m[2]);
  for (const part of parts) {
    const t = part.trim();
    const stopM = /^(\#[0-9a-f]{6}|\#[0-9a-f]{3}|rgba?\([^)]+\))\s*(?:(-?\d+(?:\.\d+)?)\s*%)?$/i.exec(t);
    if (!stopM) continue;
    stops.push({
      color:    normaliseStopColor(stopM[1]),
      position: stopM[2] !== undefined ? parseFloat(stopM[2]) : -1,
    });
  }
  if (stops.length < 2) return null;

  // Backfill any missing positions evenly across the [0, 100] range —
  // CSS lets you omit positions and the browser fills them in; we do
  // the same so subsequent edits in the picker are deterministic.
  const missing = stops.filter((s) => s.position < 0).length;
  if (missing > 0) {
    let last = 0;
    for (let i = 0; i < stops.length; i++) {
      if (stops[i].position < 0) {
        const span = stops.length === 1 ? 100 : (100 / (stops.length - 1));
        stops[i].position = Math.round(i * span);
      } else {
        last = stops[i].position;
      }
    }
    void last;
  }
  return { direction, angle, stops };
}

function splitTopLevel(s: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let cur = '';
  for (const ch of s) {
    if (ch === '(') depth++;
    else if (ch === ')') depth--;
    if (ch === ',' && depth === 0) {
      out.push(cur);
      cur = '';
    } else {
      cur += ch;
    }
  }
  if (cur.trim()) out.push(cur);
  return out;
}

function normaliseStopColor(raw: string): string {
  const s = raw.trim();
  if (/^#[0-9a-f]{6}$/i.test(s)) return s.toUpperCase();
  if (/^#[0-9a-f]{3}$/i.test(s)) {
    const r = s[1], g = s[2], b = s[3];
    return ('#' + r + r + g + g + b + b).toUpperCase();
  }
  // rgba/rgb → hex via parseFloat — best-effort.
  const m = /rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i.exec(s);
  if (m) {
    const c = (n: number) => Math.max(0, Math.min(255, n)).toString(16).padStart(2, '0');
    return ('#' + c(+m[1]) + c(+m[2]) + c(+m[3])).toUpperCase();
  }
  return s.toUpperCase();
}

/** Convenience starting value when no gradient has been set. */
export const DEFAULT_GRADIENT: GradientValue = {
  direction: 'to right',
  stops: [
    { color: '#32ACC1', position: 0   },
    { color: '#A855F7', position: 100 },
  ],
};
