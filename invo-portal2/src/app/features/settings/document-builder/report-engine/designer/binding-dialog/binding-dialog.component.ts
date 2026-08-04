import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  ViewChild,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { BindingPickerService } from '../../services/binding-picker.service';
import { DesignerStateService } from '../../services/designer-state.service';
import { flattenPaths } from '../../utils/binding-paths.utils';

type CategoryId = 'patterns' | 'fields' | 'filters' | 'operators';

interface DialogItem {
  /** Unique id within its category. */
  id: string;
  /** Label shown in the Item pane. */
  label: string;
  /** Plain-English description shown on the right when selected. */
  description: string;
  /** Self-contained example string. */
  example: string;
  /** Text spliced into the editor when the item is inserted. */
  snippet: string;
}

/**
 * Expression builder dialog. Modeled after SSRS / Crystal Reports' field
 * picker: a single editable expression area at the top and a 3-pane
 * Category / Item / Description chooser below.
 *
 * Inserts go into the dialog's OWN textarea — the original input only
 * receives the final value on OK. Cancel/backdrop close discards changes.
 *
 * Categories:
 *   - Fields    — every path reachable in the template's sampleData
 *   - Filters   — pipe filters from builtInFilters (currency, date, …)
 *   - Operators — comparison, arithmetic, and logical operators
 *
 * Clicking an item splices its snippet at the editor's caret AND selects it,
 * so the description pane doubles as confirmation that the click landed.
 */
@Component({
  selector: 'app-binding-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule],
  templateUrl: './binding-dialog.component.html',
  styleUrls: ['./binding-dialog.component.scss'],
})
export class BindingDialogComponent {
  readonly svc = inject(BindingPickerService);
  private readonly state = inject(DesignerStateService);
  /** Shared engine — reflects the host's `extraFilters` so the preview's
   *  Currency / Date filters render with the same formatter as the canvas
   *  and the export renderers. */
  private readonly bindingEngine = computed(() => this.state.bindingEngine());

  @ViewChild('editor') private editor?: ElementRef<HTMLTextAreaElement>;

  readonly expression = signal('');
  readonly searchQuery = signal('');
  readonly selectedCategory = signal<CategoryId>('fields');
  readonly selectedItem = signal<DialogItem | null>(null);

  readonly CATEGORIES: ReadonlyArray<{ id: CategoryId; label: string }> = [
    { id: 'patterns',  label: 'Patterns' },
    { id: 'fields',    label: 'Fields' },
    { id: 'filters',   label: 'Filters' },
    { id: 'operators', label: 'Operators' },
  ];

  /**
   * Recipe library — complete cell expressions for the common shapes users
   * actually write. Clicking one inserts the entire snippet at the cursor;
   * select-all-then-click to replace the editor. The label is short, the
   * description explains what the output looks like, and the example shows
   * a rendered string against the sample data.
   *
   * Order: simplest patterns first, composed/receipt patterns at the end.
   */
  readonly PATTERNS: DialogItem[] = [
    { id: 'p-field',
      label: 'Plain field',
      description: 'A single bound value — the simplest cell. Picks one field from the row.',
      example: '{{row.productName}}  →  "Shawarma Meal"',
      snippet: '{{row.productName}}' },

    { id: 'p-currency',
      label: 'Currency (BHD)',
      description: 'A number formatted as BHD currency. Use on row.total / row.price / row.subTotal.',
      example: '{{row.total | currency:BHD}}  →  "BHD 6.500"',
      snippet: '{{row.total | currency:BHD}}' },

    { id: 'p-number-2',
      label: 'Number 0.00',
      description: 'Plain number with two decimals.',
      example: '{{row.qty | number:2:2}}  →  "1.00"',
      snippet: '{{row.qty | number:2:2}}' },

    { id: 'p-date-medium',
      label: "Date — medium",
      description: 'Locale-formatted date (e.g. "May 12, 2026").',
      example: "{{invoiceDate | date:'medium'}}  →  \"May 12, 2026\"",
      snippet: "{{invoiceDate | date:'medium'}}" },

    { id: 'p-rownum',
      label: 'Row number (#)',
      description: '1-based index of the row. Use this for the leading # column.',
      example: '{{rowIndex + 1}}  →  "1"',
      snippet: '{{rowIndex + 1}}' },

    { id: 'p-default',
      label: 'Field with fallback',
      description: 'Show the value, or a placeholder dash when null / empty.',
      example: "{{row.note | default:'—'}}",
      snippet: "{{row.note | default:'—'}}" },

    { id: 'p-truncate',
      label: 'Truncate long text',
      description: 'Cap a string at 40 characters, appending an ellipsis when longer.',
      example: '{{row.productName | truncate:40}}',
      snippet: '{{row.productName | truncate:40}}' },

    { id: 'p-uppercase',
      label: 'UPPERCASE field',
      description: 'Force the value to uppercase.',
      example: '{{row.productName | uppercase}}  →  "SHAWARMA MEAL"',
      snippet: '{{row.productName | uppercase}}' },

    { id: 'p-two-fields',
      label: 'Two fields joined',
      description: 'Two bindings on one line, separated by an em-dash. Edit the bindings or the separator after inserting.',
      example: '{{row.productName}} — {{row.selectedItem.barcode}}\n→  "Shawarma Meal — 9159349354679"',
      snippet: '{{row.productName}} — {{row.selectedItem.barcode}}' },

    { id: 'p-show-when',
      label: 'Show only when …',
      description: 'Render content only when a condition is true. Replace `row.note` with whatever you want to check.',
      example: "{{row.note ? 'Note: ' + row.note : ''}}",
      snippet: "{{row.note ? 'Note: ' + row.note : ''}}" },

    { id: 'p-product-options',
      label: 'Product + options (inline)',
      description: 'Product name followed by a parenthesized comma-separated option list. Empty when there are no options.',
      example: 'Daal (Small dall)',
      snippet: "{{row.productName}}{{row.options.length ? ' (' + (row.options | pluck:optionName | join:', ') + ')' : ''}}" },

    { id: 'p-product-subitems',
      label: 'Product + subitems (bullets)',
      description: 'Product name on top, each subItem on an indented bullet line beneath.',
      example: 'Shawarma Meal\n  • الالو\n  • Shawarmaa\n  • Soft Drink',
      snippet: "{{row.productName}}{{row.subItems.length ? '\\n  • ' + (row.subItems | pluck:productName | join:'\\n  • ') : ''}}" },

    { id: 'p-receipt-full',
      label: 'Receipt: subitems w/ options',
      description: 'Full receipt-style description cell. Product name + indented subitems where each subitem shows its own options inline, plus any options on the parent line. This is the Description-column default in the sample template.',
      example: 'Shawarma Meal\n  • الالو\n  • Shawarmaa (Beef)\n  • Soft Drink',
      snippet:
        "{{row.productName}}" +
        "{{row.subItems.length ? '\\n  • ' + (row.subItems | each:\"{{row.productName}}{{row.options.length ? ' (' + (row.options | pluck:optionName | join:', ') + ')' : ''}}\" | join:'\\n  • ') : ''}}" +
        "{{row.options.length ? '\\n  (' + (row.options | pluck:optionName | join:', ') + ')' : ''}}" },
  ];

  /** Operator catalog — matches what the expression parser accepts. The
   *  `snippet` strings include the spaces that read naturally around binary
   *  ops; unary ops (!, -) are emitted without trailing space. */
  readonly OPERATORS: DialogItem[] = [
    { id: 'op-eq',   label: '==', description: 'Equal to. Loose equality — strings and numbers compare with type coercion (JS-style).', example: "status == 'Paid'", snippet: ' == ' },
    { id: 'op-neq',  label: '!=', description: 'Not equal to.', example: "status != 'Voided'", snippet: ' != ' },
    { id: 'op-gt',   label: '>',  description: 'Greater than (numeric).', example: 'row.qty > 0', snippet: ' > ' },
    { id: 'op-gte',  label: '>=', description: 'Greater than or equal.', example: 'row.qty >= 1', snippet: ' >= ' },
    { id: 'op-lt',   label: '<',  description: 'Less than (numeric).', example: 'row.qty < 10', snippet: ' < ' },
    { id: 'op-lte',  label: '<=', description: 'Less than or equal.', example: 'balance <= 0', snippet: ' <= ' },
    { id: 'op-and',  label: '&&', description: 'Logical AND. Short-circuits.', example: "isPaid && total > 0", snippet: ' && ' },
    { id: 'op-or',   label: '||', description: 'Logical OR. Short-circuits.', example: "status == 'Paid' || status == 'Settled'", snippet: ' || ' },
    { id: 'op-not',  label: '!',  description: 'Logical NOT. Negates the following expression.', example: '!isVoided', snippet: '!' },
    { id: 'op-plus', label: '+',  description: 'Addition. If either side is a string, concatenates.', example: "'Total: ' + total", snippet: ' + ' },
    { id: 'op-minus',label: '−',  description: 'Subtraction.', example: 'total - discount', snippet: ' - ' },
    { id: 'op-mul',  label: '×',  description: 'Multiplication.', example: 'row.qty * row.price', snippet: ' * ' },
    { id: 'op-div',  label: '÷',  description: 'Division.', example: 'subtotal / count', snippet: ' / ' },
    { id: 'op-mod',  label: '%',  description: 'Remainder (modulo).', example: 'rowIndex % 2', snippet: ' % ' },
    { id: 'op-tern', label: '? :',description: 'Ternary if/else. Evaluates the condition and returns the matching branch.', example: 'qty > 0 ? qty : 0', snippet: ' ? a : b' },
  ];

  /** Filter catalog — mirrors `builtInFilters` from the expression engine. */
  readonly FILTERS: DialogItem[] = [
    { id: 'f-curr-bhd', label: 'currency:BHD',  description: 'Format a number as Bahraini Dinar (3-decimal) using the template locale.', example: '177.54 → BHD 177.540',                 snippet: ' | currency:BHD' },
    { id: 'f-curr-usd', label: 'currency:USD',  description: 'Format a number as US Dollars (2-decimal).',                                   example: '177.54 → $177.54',                       snippet: ' | currency:USD' },
    { id: 'f-num-2',    label: "number:2:2",    description: 'Format a number with min/max fraction digits.',                                example: '177.5 → 177.50',                         snippet: ' | number:2:2' },
    { id: 'f-percent',  label: 'percent:0',     description: 'Format a fraction as a percentage. Argument is decimal places.',               example: '0.085 → 9%',                             snippet: ' | percent:0' },
    { id: 'f-date-s',   label: "date:'short'",  description: "Short locale date (e.g. 5/10/26).",                                            example: '2026-05-10 → 5/10/26',                   snippet: " | date:'short'" },
    { id: 'f-date-m',   label: "date:'medium'", description: 'Medium locale date (May 10, 2026).',                                            example: '2026-05-10 → May 10, 2026',              snippet: " | date:'medium'" },
    { id: 'f-date-dt',  label: "date:'datetime'", description: 'Date with short time.',                                                       example: '2026-05-10T10:30 → May 10, 2026, 10:30', snippet: " | date:'datetime'" },
    { id: 'f-date-iso', label: "date:'iso'",    description: 'ISO 8601 string.',                                                              example: '2026-05-10 → 2026-05-10T00:00:00Z',      snippet: " | date:'iso'" },
    { id: 'f-upper',    label: 'uppercase',     description: 'Convert to uppercase.',                                                         example: "'abc' → 'ABC'",                          snippet: ' | uppercase' },
    { id: 'f-lower',    label: 'lowercase',     description: 'Convert to lowercase.',                                                         example: "'ABC' → 'abc'",                          snippet: ' | lowercase' },
    { id: 'f-cap',      label: 'capitalize',    description: 'Capitalize the first character.',                                               example: "'hello' → 'Hello'",                      snippet: ' | capitalize' },
    { id: 'f-trim',     label: 'trim',          description: 'Trim leading/trailing whitespace.',                                             example: "'  hi  ' → 'hi'",                         snippet: ' | trim' },
    { id: 'f-trunc',    label: 'truncate:40',   description: 'Truncate to N characters, appending ellipsis if longer.',                       example: "long text → 'long…'",                    snippet: ' | truncate:40' },
    { id: 'f-default',  label: "default:'—'",   description: "Replace null / undefined / empty with the supplied fallback.",                  example: "'' → '—'",                               snippet: " | default:'—'" },
    { id: 'f-pad',      label: 'pad:5:0',       description: 'Left-pad with a character to a length.',                                        example: "42 → '00042'",                           snippet: ' | pad:5:0' },
    { id: 'f-length',   label: 'length',        description: 'Length of a string or array.',                                                  example: '[1,2,3] → 3',                            snippet: ' | length' },
    { id: 'f-pluck',    label: 'pluck:field',   description: "Project each element of an array through a field path. Pair with `join` for nested arrays. Quote the path when it contains dots (e.g. pluck:'selectedItem.name').", example: "[{a:1},{a:2}] | pluck:a → [1,2]",       snippet: ' | pluck:field' },
    { id: 'f-each',     label: 'each:"<tpl>"',  description: "Project each element through a TEMPLATE. Inside the template, `row` is rebound to the current element, so use `{{row.x}}` to reach its fields (same syntax as outside the filter). Use this when subItem rows need to show their own nested options too.", example: "subItems | each:\"{{row.productName}}{{row.options.length?' ('+(row.options|pluck:optionName|join:', ')+')':''}}\" | join:'\\n  • '", snippet: ' | each:"{{row.productName}}"' },
    { id: 'f-join',     label: "join:', '",     description: 'Join array elements with a separator. Use after `pluck` to flatten arrays of objects.', example: "['a','b'] → 'a, b'",                     snippet: " | join:', '" },
    { id: 'f-join-nl',  label: "join:'\\n'",   description: 'Join with newlines — table cells render newlines as visual line breaks.',         example: "['a','b'] → 'a\\nb'",                    snippet: " | join:'\\n'" },
    { id: 'f-arabic',   label: 'arabicDigits',  description: "Convert Western digits to Arabic-Indic when the locale starts with 'ar'.",     example: "'2026' → '٢٠٢٦' (ar)",                   snippet: ' | arabicDigits' },
  ];

  /**
   * Field items derived from sampleData. Two modes:
   *
   *   1. Row context (`svc.rowSource()` set) — resolves the data-source
   *      array, takes its first element, and flattens with a `row.` prefix.
   *      Matches the binding scope cell expressions actually evaluate in.
   *
   *   2. Otherwise — flattens the top-level sampleData with absolute paths.
   */
  readonly fieldItems = computed<(DialogItem & { depth: number })[]>(() => {
    const t = this.state.template();
    if (!t?.sampleData) return [];

    const rowSource = this.svc.rowSource();
    if (rowSource) {
      try {
        const ctx = this.bindingEngine().createRoot(
          t.sampleData as Record<string, unknown>,
          t.locale,
          {},
        );
        const arr = this.bindingEngine().resolveArray(rowSource, ctx);
        if (arr.length > 0) {
          const paths = flattenPaths(arr[0], { maxDepth: 3 });
          return paths.map((p) => ({
            id: `row.${p.path}`,
            label: `row.${p.path}`,
            description: `${p.kind === 'array' ? 'Array' : p.kind === 'object' ? 'Object' : 'Scalar'} field on each \`${rowSource}\` row.${p.kind !== 'scalar' ? ' Drill in for nested paths.' : ''}`,
            example: `row.${p.path}\nSample value: ${p.example}`,
            snippet: `row.${p.path}`,
            depth: p.depth,
          }));
        }
      } catch {
        // fall through to absolute mode below
      }
    }

    const paths = flattenPaths(t.sampleData, { maxDepth: 3 });
    return paths.map((p) => ({
      id: p.path,
      label: p.path,
      description: `${p.kind === 'array' ? 'Array' : p.kind === 'object' ? 'Object' : 'Scalar'} at ${p.path}.${p.kind !== 'scalar' ? ' Drill in for child paths.' : ''}`,
      example: `${p.path}\nSample value: ${p.example}`,
      snippet: p.path,
      depth: p.depth,
    }));
  });

  readonly currentItems = computed<(DialogItem & { depth?: number })[]>(() => {
    const cat = this.selectedCategory();
    const items: (DialogItem & { depth?: number })[] =
      cat === 'patterns' ? this.PATTERNS :
      cat === 'fields' ? this.fieldItems() :
      cat === 'filters' ? this.FILTERS :
      this.OPERATORS;
    const q = this.searchQuery().trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (i) => i.label.toLowerCase().includes(q) || i.description.toLowerCase().includes(q),
    );
  });

  /** Live validation of the dialog's editor against current sample data.
   *  Mirrors the same kind of feedback shown beneath property-panel inputs. */
  readonly validation = computed<{ kind: 'ok'; display: string } | { kind: 'error'; message: string } | null>(() => {
    const src = this.expression().trim();
    if (!src) return null;
    const t = this.state.template();
    if (!t) return null;
    try {
      const ctx = this.bindingEngine().createRoot(
        (t.sampleData ?? {}) as Record<string, unknown>,
        t.locale,
        {},
      );
      const v = this.bindingEngine().evaluateCell(src, ctx);
      const display = v === null ? 'null'
        : v === undefined ? 'undefined'
        : typeof v === 'string' ? `"${v.length > 60 ? v.slice(0, 57) + '…' : v}"`
        : String(v);
      return { kind: 'ok', display };
    } catch (e) {
      return { kind: 'error', message: e instanceof Error ? e.message : String(e) };
    }
  });

  constructor() {
    // On open: seed the editor with the input's current value and reset
    // navigation state. Patterns is the default landing tab — that's the
    // friendliest entry point for non-technical users (ready-made recipes
    // they can drop in without writing pipes / ternaries).
    effect(() => {
      const el = this.svc.target();
      if (!el) return;
      this.expression.set(el.value);
      this.searchQuery.set('');
      this.selectedCategory.set('patterns');
      this.selectedItem.set(null);
      queueMicrotask(() => {
        const t = this.editor?.nativeElement;
        if (t) {
          t.focus();
          t.setSelectionRange(t.value.length, t.value.length);
        }
      });
    });
  }

  onSelectCategory(id: CategoryId): void {
    this.selectedCategory.set(id);
    this.selectedItem.set(null);
  }

  /** Splice the item's snippet at the editor's current caret. Wraps the
   *  inserted path/expression in `{{ }}` only when the editor's text
   *  already contains template placeholders — preserves single-expression
   *  semantics for typed-once column expressions.
   *
   *  Click-to-insert pattern: the same call updates `selectedItem` so the
   *  description pane previews whatever was most recently added, which
   *  doubles as feedback that the click actually inserted something. */
  insertItem(item: DialogItem): void {
    const editor = this.editor?.nativeElement;
    if (!editor) return;
    const start = editor.selectionStart ?? this.expression().length;
    const end = editor.selectionEnd ?? this.expression().length;
    const current = this.expression();

    const snippet = this.shouldWrapInBraces(item, current)
      ? `{{${item.snippet}}}`
      : item.snippet;
    const next = current.slice(0, start) + snippet + current.slice(end);
    this.expression.set(next);
    this.selectedItem.set(item);

    queueMicrotask(() => {
      const pos = start + snippet.length;
      editor.setSelectionRange(pos, pos);
      editor.focus();
    });
  }

  /** Field paths get the `{{ }}` wrapper when the editor is already in
   *  template mode (contains `{{ }}` somewhere). Filters and operators are
   *  always inserted raw — they only make sense inline. */
  private shouldWrapInBraces(item: DialogItem, current: string): boolean {
    if (this.selectedCategory() !== 'fields') return false;
    return current.includes('{{') || current.includes('}}');
  }

  commit(): void {
    this.svc.commit(this.expression());
  }

  cancel(): void {
    this.svc.close();
  }
}
