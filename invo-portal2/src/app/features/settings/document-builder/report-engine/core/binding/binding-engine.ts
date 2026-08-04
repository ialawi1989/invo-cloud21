import { BindingContext, FilterMap } from '../types';
import { ExpressionEvaluator } from '../expression/evaluator';

/**
 * BindingEngine is the only API surface block renderers should touch.
 * It wraps the evaluator and provides scope helpers (rows, groups, pages).
 */
export class BindingEngine {
  private readonly evaluator: ExpressionEvaluator;

  constructor(extraFilters: FilterMap = {}) {
    this.evaluator = new ExpressionEvaluator(extraFilters);
  }

  createRoot(data: Record<string, unknown>, locale: string, vars: Record<string, unknown> = {}): BindingContext {
    return Object.freeze({
      data,
      locale,
      vars,
      page: { current: 1, total: 1 },
    });
  }

  withPage(ctx: BindingContext, current: number, total: number): BindingContext {
    return { ...ctx, page: { current, total } };
  }

  withRow(ctx: BindingContext, row: Record<string, unknown>, rowIndex: number): BindingContext {
    return { ...ctx, row, rowIndex };
  }

  withGroup(ctx: BindingContext, key: unknown, rows: unknown[], index: number): BindingContext {
    return { ...ctx, group: { key, rows, index } };
  }

  /** Evaluate "{{ ... }}" placeholders inside text. */
  interpolate(template: string, ctx: BindingContext): string {
    return this.evaluator.interpolate(template, ctx);
  }

  /** Evaluate a raw expression (no surrounding text). */
  evaluate(expression: string, ctx: BindingContext): unknown {
    return this.evaluator.evaluateExpression(expression, ctx);
  }

  /**
   * Cell-style eval. If the input contains a template placeholder (`{{ … }}`)
   * the whole thing is interpolated as a string — letting authors combine
   * multiple bindings in a single cell, e.g.
   *   `{{row.productName}} — {{row.selectedItem.barcode}}`
   * Otherwise behaves exactly like `evaluate()` so existing single-expression
   * columns (numeric paths, arithmetic, pipes) keep their raw types.
   */
  evaluateCell(expression: string, ctx: BindingContext): unknown {
    if (expression.includes('{{')) return this.interpolate(expression, ctx);
    return this.evaluator.evaluateExpression(expression, ctx);
  }

  /** Visibility/conditional check. */
  isTruthy(expression: string | undefined, ctx: BindingContext): boolean {
    return this.evaluator.evaluateCondition(expression, ctx);
  }

  /**
   * Resolve a data source path (used by tables) to an array.
   * Falls back to empty array if missing — render must remain stable.
   */
  resolveArray(path: string, ctx: BindingContext): unknown[] {
    const v = this.evaluate(path, ctx);
    return Array.isArray(v) ? v : [];
  }

  /**
   * Aggregate helper used by table footers.
   * Expressions are evaluated against each row and reduced.
   */
  aggregate(
    kind: 'sum' | 'avg' | 'count' | 'min' | 'max',
    rows: unknown[],
    rowExpression: string,
    ctx: BindingContext,
  ): number {
    if (kind === 'count') return rows.length;
    let acc = 0;
    let min = Number.POSITIVE_INFINITY;
    let max = Number.NEGATIVE_INFINITY;
    let count = 0;
    for (let i = 0; i < rows.length; i++) {
      const rowCtx = this.withRow(ctx, rows[i] as Record<string, unknown>, i);
      const v = Number(this.evaluate(rowExpression, rowCtx));
      if (!Number.isFinite(v)) continue;
      acc += v;
      if (v < min) min = v;
      if (v > max) max = v;
      count++;
    }
    switch (kind) {
      case 'sum':
        return acc;
      case 'avg':
        return count ? acc / count : 0;
      case 'min':
        return count ? min : 0;
      case 'max':
        return count ? max : 0;
    }
  }
}
