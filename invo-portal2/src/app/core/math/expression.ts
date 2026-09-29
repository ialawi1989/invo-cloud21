/** Safe evaluator for `+ - * /` and parentheses (no eval). Returns null when the text isn't a valid expression. */
export function evalArithmetic(text: string): number | null {
  const s = text.replace(/\s+/g, '');
  if (!s) return null;
  let i = 0;
  const peek = () => s[i];
  const number = (): number | null => {
    const m = /^\d*\.?\d+|^\d+\.?/.exec(s.slice(i));
    if (!m) return null;
    i += m[0].length;
    return parseFloat(m[0]);
  };
  const factor = (): number | null => {
    if (peek() === '+') { i++; return factor(); }
    if (peek() === '-') { i++; const v = factor(); return v == null ? null : -v; }
    if (peek() === '(') {
      i++;
      const v = expr();
      if (v == null || peek() !== ')') return null;
      i++;
      return v;
    }
    return number();
  };
  const term = (): number | null => {
    let v = factor();
    while (v != null && (peek() === '*' || peek() === '/')) {
      const op = s[i++];
      const r = factor();
      if (r == null) return null;
      v = op === '*' ? v * r : v / r;
    }
    return v;
  };
  const expr = (): number | null => {
    let v = term();
    while (v != null && (peek() === '+' || peek() === '-')) {
      const op = s[i++];
      const r = term();
      if (r == null) return null;
      v = op === '+' ? v + r : v - r;
    }
    return v;
  };
  const out = expr();
  return out != null && i === s.length && Number.isFinite(out) ? out : null;
}
