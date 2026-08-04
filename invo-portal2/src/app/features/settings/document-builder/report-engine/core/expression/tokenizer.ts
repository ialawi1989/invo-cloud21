/**
 * Tokenizer for binding expressions. Supports:
 *   path.to.value
 *   path[0].to[name]
 *   path | filter:arg1:arg2 | other
 *   "literal string"  'literal'  123  true  false  null
 *   condition ternary:  a > b ? x : y
 *   parens:  (a + b) * c
 *
 * The tokenizer is intentionally small — strict syntax means clear error messages.
 */
export type TokenKind =
  | 'identifier'
  | 'number'
  | 'string'
  | 'boolean'
  | 'null'
  | 'dot'
  | 'lbracket'
  | 'rbracket'
  | 'lparen'
  | 'rparen'
  | 'pipe'
  | 'colon'
  | 'comma'
  | 'question'
  | 'op'
  | 'eof';

export interface Token {
  kind: TokenKind;
  value: string;
  pos: number;
}

const OPS = ['==', '!=', '>=', '<=', '&&', '||', '+', '-', '*', '/', '%', '>', '<', '!'];

export class ExpressionTokenizer {
  private pos = 0;
  constructor(private readonly src: string) {}

  tokenize(): Token[] {
    const out: Token[] = [];
    while (this.pos < this.src.length) {
      const ch = this.src[this.pos];
      if (ch === ' ' || ch === '\t' || ch === '\n') {
        this.pos++;
        continue;
      }
      const start = this.pos;
      if (ch === '"' || ch === "'") {
        out.push(this.readString(ch));
        continue;
      }
      if (this.isDigit(ch) || (ch === '-' && this.isDigit(this.peek(1)))) {
        out.push(this.readNumber());
        continue;
      }
      if (this.isIdentStart(ch)) {
        out.push(this.readIdentifier());
        continue;
      }
      const op = this.matchOp();
      if (op) {
        out.push({ kind: 'op', value: op, pos: start });
        this.pos += op.length;
        continue;
      }
      switch (ch) {
        case '.':
          out.push({ kind: 'dot', value: '.', pos: start });
          this.pos++;
          break;
        case '[':
          out.push({ kind: 'lbracket', value: '[', pos: start });
          this.pos++;
          break;
        case ']':
          out.push({ kind: 'rbracket', value: ']', pos: start });
          this.pos++;
          break;
        case '(':
          out.push({ kind: 'lparen', value: '(', pos: start });
          this.pos++;
          break;
        case ')':
          out.push({ kind: 'rparen', value: ')', pos: start });
          this.pos++;
          break;
        case '|':
          out.push({ kind: 'pipe', value: '|', pos: start });
          this.pos++;
          break;
        case ':':
          out.push({ kind: 'colon', value: ':', pos: start });
          this.pos++;
          break;
        case ',':
          out.push({ kind: 'comma', value: ',', pos: start });
          this.pos++;
          break;
        case '?':
          out.push({ kind: 'question', value: '?', pos: start });
          this.pos++;
          break;
        default:
          throw new Error(`Unexpected character '${ch}' at ${this.pos}`);
      }
    }
    out.push({ kind: 'eof', value: '', pos: this.pos });
    return out;
  }

  private peek(offset: number): string {
    return this.src[this.pos + offset] ?? '';
  }
  private isDigit(c: string): boolean {
    return c >= '0' && c <= '9';
  }
  private isIdentStart(c: string): boolean {
    return (c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') || c === '_' || c === '$';
  }
  private isIdent(c: string): boolean {
    return this.isIdentStart(c) || this.isDigit(c);
  }

  private readString(quote: string): Token {
    const start = this.pos;
    this.pos++;
    let value = '';
    while (this.pos < this.src.length && this.src[this.pos] !== quote) {
      if (this.src[this.pos] === '\\' && this.pos + 1 < this.src.length) {
        // Map the common escapes that show up in template separators —
        // anything else falls through as the literal character so users
        // can still write `\'` or `\"` to embed the matching quote.
        const esc = this.src[this.pos + 1];
        value +=
          esc === 'n' ? '\n' :
          esc === 't' ? '\t' :
          esc === 'r' ? '\r' :
          esc === '\\' ? '\\' :
          esc;
        this.pos += 2;
      } else {
        value += this.src[this.pos++];
      }
    }
    if (this.src[this.pos] !== quote) throw new Error('Unterminated string literal');
    this.pos++;
    return { kind: 'string', value, pos: start };
  }

  private readNumber(): Token {
    const start = this.pos;
    if (this.src[this.pos] === '-') this.pos++;
    while (this.pos < this.src.length && this.isDigit(this.src[this.pos])) this.pos++;
    if (this.src[this.pos] === '.' && this.isDigit(this.peek(1))) {
      this.pos++;
      while (this.pos < this.src.length && this.isDigit(this.src[this.pos])) this.pos++;
    }
    return { kind: 'number', value: this.src.slice(start, this.pos), pos: start };
  }

  private readIdentifier(): Token {
    const start = this.pos;
    while (this.pos < this.src.length && this.isIdent(this.src[this.pos])) this.pos++;
    const value = this.src.slice(start, this.pos);
    if (value === 'true' || value === 'false') return { kind: 'boolean', value, pos: start };
    if (value === 'null' || value === 'undefined') return { kind: 'null', value, pos: start };
    return { kind: 'identifier', value, pos: start };
  }

  private matchOp(): string | null {
    for (const op of OPS) {
      if (this.src.startsWith(op, this.pos)) return op;
    }
    return null;
  }
}
