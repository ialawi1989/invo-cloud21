import { ExpressionTokenizer, Token, TokenKind } from './tokenizer';

export interface PathSegment {
  kind: 'prop' | 'index';
  value: string | number;
}

export type Ast =
  | { kind: 'literal'; value: string | number | boolean | null }
  | { kind: 'path'; segments: PathSegment[] }
  | { kind: 'unary'; op: string; arg: Ast }
  | { kind: 'binary'; op: string; left: Ast; right: Ast }
  | { kind: 'ternary'; test: Ast; consequent: Ast; alternate: Ast }
  | { kind: 'pipe'; source: Ast; filter: string; args: string[] };

const PRECEDENCE: Record<string, number> = {
  '||': 1,
  '&&': 2,
  '==': 3,
  '!=': 3,
  '<': 4,
  '<=': 4,
  '>': 4,
  '>=': 4,
  '+': 5,
  '-': 5,
  '*': 6,
  '/': 6,
  '%': 6,
};

/**
 * Recursive-descent parser with precedence climbing for binaries.
 * Pipes are top-level: only allowed at the outermost expression.
 *
 * Grammar (informal):
 *   expression  := pipe
 *   pipe        := ternary ('|' identifier (':' arg)*)*
 *   ternary     := binary ('?' ternary ':' ternary)?
 *   binary      := unary (op binary)*  (with precedence)
 *   unary       := ('!' | '-')? primary
 *   primary     := literal | path | '(' expression ')'
 *   path        := identifier ('.' identifier | '[' (string | number) ']')*
 */
export class ExpressionParser {
  private tokens: Token[] = [];
  private i = 0;

  parse(src: string): Ast {
    this.tokens = new ExpressionTokenizer(src).tokenize();
    this.i = 0;
    const node = this.parsePipe();
    this.expect('eof');
    return node;
  }

  private parsePipe(): Ast {
    let node = this.parseTernary();
    while (this.peek().kind === 'pipe') {
      this.next(); // |
      const idTok = this.expect('identifier');
      const args: string[] = [];
      while (this.peek().kind === 'colon') {
        this.next();
        const tok = this.next();
        args.push(tok.value);
      }
      node = { kind: 'pipe', source: node, filter: idTok.value, args };
    }
    return node;
  }

  private parseTernary(): Ast {
    const test = this.parseBinary(0);
    if (this.peek().kind === 'question') {
      this.next();
      const consequent = this.parseTernary();
      this.expect('colon');
      const alternate = this.parseTernary();
      return { kind: 'ternary', test, consequent, alternate };
    }
    return test;
  }

  private parseBinary(minPrec: number): Ast {
    let left = this.parseUnary();
    while (true) {
      const tok = this.peek();
      if (tok.kind !== 'op') break;
      const prec = PRECEDENCE[tok.value];
      if (prec === undefined || prec < minPrec) break;
      this.next();
      const right = this.parseBinary(prec + 1);
      left = { kind: 'binary', op: tok.value, left, right };
    }
    return left;
  }

  private parseUnary(): Ast {
    const tok = this.peek();
    if (tok.kind === 'op' && (tok.value === '!' || tok.value === '-')) {
      this.next();
      return { kind: 'unary', op: tok.value, arg: this.parseUnary() };
    }
    return this.parsePrimary();
  }

  private parsePrimary(): Ast {
    const tok = this.peek();
    switch (tok.kind) {
      case 'number':
        this.next();
        return { kind: 'literal', value: Number(tok.value) };
      case 'string':
        this.next();
        return { kind: 'literal', value: tok.value };
      case 'boolean':
        this.next();
        return { kind: 'literal', value: tok.value === 'true' };
      case 'null':
        this.next();
        return { kind: 'literal', value: null };
      case 'lparen': {
        this.next();
        const inner = this.parsePipe();
        this.expect('rparen');
        return inner;
      }
      case 'identifier':
        return this.parsePath();
      default:
        throw new Error(`Unexpected token '${tok.value}' at ${tok.pos}`);
    }
  }

  private parsePath(): Ast {
    const segs: PathSegment[] = [];
    const first = this.expect('identifier');
    segs.push({ kind: 'prop', value: first.value });
    while (true) {
      const tok = this.peek();
      if (tok.kind === 'dot') {
        this.next();
        const id = this.expect('identifier');
        segs.push({ kind: 'prop', value: id.value });
      } else if (tok.kind === 'lbracket') {
        this.next();
        const inner = this.next();
        if (inner.kind === 'number') {
          segs.push({ kind: 'index', value: Number(inner.value) });
        } else if (inner.kind === 'string') {
          segs.push({ kind: 'prop', value: inner.value });
        } else {
          throw new Error(`Invalid index ${inner.value}`);
        }
        this.expect('rbracket');
      } else {
        break;
      }
    }
    return { kind: 'path', segments: segs };
  }

  private peek(): Token {
    return this.tokens[this.i];
  }
  private next(): Token {
    return this.tokens[this.i++];
  }
  private expect(kind: TokenKind): Token {
    const tok = this.next();
    if (tok.kind !== kind) {
      throw new Error(`Expected ${kind} but got ${tok.kind} ('${tok.value}') at ${tok.pos}`);
    }
    return tok;
  }
}
