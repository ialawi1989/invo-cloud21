import { BindingContext, FilterHelpers, FilterMap } from '../types';
import { Ast, ExpressionParser, PathSegment } from './parser';
import { builtInFilters } from './filters';

/**
 * Cached evaluator. Compiling expressions is expensive vs. evaluating, so we
 * memoize parsed ASTs by source string. In production this map is bounded
 * automatically because the number of distinct expressions in a template is small.
 */
export class ExpressionEvaluator {
  private readonly parser = new ExpressionParser();
  private readonly cache = new Map<string, Ast>();
  private readonly filters: FilterMap;

  constructor(extraFilters: FilterMap = {}) {
    this.filters = { ...builtInFilters, ...extraFilters };
  }

  /** Compile or fetch an AST for a raw expression. */
  compile(src: string): Ast {
    const trimmed = src.trim();
    let ast = this.cache.get(trimmed);
    if (!ast) {
      ast = this.parser.parse(trimmed);
      this.cache.set(trimmed, ast);
    }
    return ast;
  }

  /** Evaluate an already-compiled AST. */
  evaluate(ast: Ast, ctx: BindingContext): unknown {
    switch (ast.kind) {
      case 'literal':
        return ast.value;

      case 'path':
        return this.resolvePath(ast.segments, ctx);

      case 'unary': {
        const v = this.evaluate(ast.arg, ctx);
        if (ast.op === '!') return !v;
        if (ast.op === '-') return -Number(v);
        return v;
      }

      case 'binary': {
        // Short-circuit logical ops.
        if (ast.op === '&&') {
          const l = this.evaluate(ast.left, ctx);
          return l ? this.evaluate(ast.right, ctx) : l;
        }
        if (ast.op === '||') {
          const l = this.evaluate(ast.left, ctx);
          return l ? l : this.evaluate(ast.right, ctx);
        }
        const left = this.evaluate(ast.left, ctx);
        const right = this.evaluate(ast.right, ctx);
        return this.applyBinary(ast.op, left, right);
      }

      case 'ternary':
        return this.evaluate(ast.test, ctx)
          ? this.evaluate(ast.consequent, ctx)
          : this.evaluate(ast.alternate, ctx);

      case 'pipe': {
        const value = this.evaluate(ast.source, ctx);
        const fn = this.filters[ast.filter];
        if (!fn) throw new Error(`Unknown filter '${ast.filter}'`);
        // Filters that recurse (e.g. `each:'<tpl>'`) need engine access.
        // Pass a small helpers object so they can interpolate sub-templates
        // and synthesize row-scoped contexts without touching internals.
        const helpers: FilterHelpers = {
          interpolate: (tpl, c) => this.interpolate(tpl, c),
          withRow: (c, row, index) => ({ ...c, row, rowIndex: index }),
        };
        return fn(value, ast.args, ctx, helpers);
      }
    }
  }

  /** Convenience: compile + evaluate. Returns coerced string for templates. */
  evaluateExpression(src: string, ctx: BindingContext): unknown {
    return this.evaluate(this.compile(src), ctx);
  }

  /**
   * Render a string with embedded {{expressions}}. This is what TextBlock uses.
   * Non-expression text is preserved verbatim.
   *
   * Uses a depth-counting scanner (not a regex) so nested `{{ … }}` blocks
   * survive correctly. Example: the outer cell expression
   *   `{{row.subItems | each:"{{productName}}" | join:', '}}`
   * needs the inner `{{productName}}` to stay PART OF the outer expression's
   * string-literal arg — a naive regex would end the outer match at the
   * first `}}` it sees, mangling the expression. The depth counter only
   * pops the outer block when its own matching `}}` arrives.
   */
  interpolate(template: string, ctx: BindingContext): string {
    if (!template) return '';
    let out = '';
    let i = 0;
    while (i < template.length) {
      if (template[i] === '{' && template[i + 1] === '{') {
        const closeIdx = this.findMatchingClose(template, i + 2);
        if (closeIdx === -1) {
          // Unmatched opener — keep literal and advance one char.
          out += template[i];
          i += 1;
          continue;
        }
        const expr = template.slice(i + 2, closeIdx);
        try {
          const v = this.evaluateExpression(expr, ctx);
          out += v === null || v === undefined ? '' : String(v);
        } catch (e) {
          // Fail-soft: keep render alive even when one binding is broken.
          console.warn(`Expression error in '${expr}':`, e);
        }
        i = closeIdx + 2;
      } else {
        out += template[i];
        i += 1;
      }
    }
    return out;
  }

  /** Scan forward from `start` and return the index of the `}}` that
   *  balances the `{{` immediately before `start`. Returns -1 if not found. */
  private findMatchingClose(template: string, start: number): number {
    let depth = 1;
    let i = start;
    while (i < template.length) {
      if (template[i] === '{' && template[i + 1] === '{') {
        depth += 1;
        i += 2;
      } else if (template[i] === '}' && template[i + 1] === '}') {
        depth -= 1;
        if (depth === 0) return i;
        i += 2;
      } else {
        i += 1;
      }
    }
    return -1;
  }

  /** Boolean coercion for visibility/conditional styles. Parse/eval errors
   *  collapse to `false` (hide on broken expression) but are logged so
   *  template authors can see what went wrong in DevTools — previously silent. */
  evaluateCondition(src: string | undefined, ctx: BindingContext): boolean {
    if (!src) return true;
    try {
      return Boolean(this.evaluateExpression(src, ctx));
    } catch (e) {
      console.warn(`Visibility/condition expression error in '${src}':`, e);
      return false;
    }
  }

  // ─── internals ───────────────────────────────────────────────

  private resolvePath(
    segments: PathSegment[],
    ctx: BindingContext,
  ): unknown {
    const head = segments[0];
    if (head.kind !== 'prop') return undefined;
    let cursor: unknown = this.resolveRoot(String(head.value), ctx);
    for (let i = 1; i < segments.length; i++) {
      if (cursor === null || cursor === undefined) return undefined;
      const seg = segments[i];
      if (seg.kind === 'prop') {
        cursor = (cursor as Record<string, unknown>)[String(seg.value)];
      } else {
        cursor = (cursor as unknown[])[Number(seg.value)];
      }
    }
    return cursor;
  }

  private resolveRoot(name: string, ctx: BindingContext): unknown {
    // Special scopes get priority — row, group, page — then data, then vars.
    if (name === 'row' && ctx.row) return ctx.row;
    if (name === 'rowIndex' && ctx.rowIndex !== undefined) return ctx.rowIndex;
    if (name === 'group' && ctx.group) return ctx.group;
    if (name === 'page') return ctx.page;
    if (name === 'vars') return ctx.vars;
    if (name in ctx.vars) return ctx.vars[name];
    return ctx.data[name];
  }

  private applyBinary(op: string, l: unknown, r: unknown): unknown {
    switch (op) {
      case '+':
        // String + anything = string concat (mirrors JS, sane for templates).
        if (typeof l === 'string' || typeof r === 'string') return String(l ?? '') + String(r ?? '');
        return Number(l) + Number(r);
      case '-':
        return Number(l) - Number(r);
      case '*':
        return Number(l) * Number(r);
      case '/':
        return Number(l) / Number(r);
      case '%':
        return Number(l) % Number(r);
      case '==':
        return l == r;
      case '!=':
        return l != r;
      case '<':
        return Number(l) < Number(r);
      case '<=':
        return Number(l) <= Number(r);
      case '>':
        return Number(l) > Number(r);
      case '>=':
        return Number(l) >= Number(r);
      default:
        throw new Error(`Unknown operator ${op}`);
    }
  }
}
