import { PoolClient } from "node_modules/@types/pg";
import { DbClient } from "../promotions/common/sql";
import { PromotionsRepository } from "../promotions/promotions.data";
import { TemplateRepository } from "./template.data"
import { Template } from "./template.modal";
import { PageInfo } from "../promotions/common/pagination";
import { SortInfo } from "../promotions/common/sortInfo";
export class TemplateProvider {
    public static async Create(client?: PoolClient) {
        client = client || (await DbClient());
        const promotionsRepository = new PromotionsRepository(client);
        return new TemplateProvider(
            new TemplateRepository(promotionsRepository, client)
        );
    }

    private TemplateRepository: TemplateRepository;
    constructor(
        TemplateRepository: TemplateRepository,
    ) {
        this.TemplateRepository = TemplateRepository;
    }

    async getTemplates(companyId: string, pageInfo?: PageInfo,
        sortInfo?: SortInfo): Promise<Template[]> {
        return await this.TemplateRepository.getTemplates(companyId, pageInfo, sortInfo)
    }

    async getTemplateById(id: string): Promise<Template> {
        return await this.TemplateRepository.getTemplateById(id)
    }

    async createTemplate(companyId: string, employeeId: string, template: Template) {
        return await this.TemplateRepository.createTemplate(companyId, employeeId, template)
    }

    async updateTemplate(companyId: string, employeeId: string, id: string, template: Template) {
        return await this.TemplateRepository.updateTemplate(companyId, employeeId, id, template)
    }

    async deleteTemplate(employeeId: string, id: string) {
        return await this.TemplateRepository.deleteTemplate(employeeId, id)
    }


    /**
     * Finds next template expression using regex starting from position
     */
    findNextTemplateExpression(
        template: string,
        startFrom: number = 0
    ): TemplateMatchPosition | null {

        // Create regex with 'g' flag and set lastIndex
        const pattern = /\{\{((?:[^{}]|\{(?!\{)|\}(?!\}))*(?:\{\{(?:[^{}]|\{(?!\{)|\}(?!\}))*\}\}(?:[^{}]|\{(?!\{)|\}(?!\}))*)*)\}\}/g;
        pattern.lastIndex = startFrom;

        const match = pattern.exec(template);

        if (!match) {
            return null;
        }

        return {
            startIndex: match.index,
            endIndex: match.index + match[0].length,
            expression: match[1].trim()
        };
    }

    static validateJson(input: string | object): { valid: boolean; data?: any; error?: string } {
        if (typeof input === 'object') {
            // Already an object, no need to parse
            return { valid: true, data: input };
        }

        try {
            const data = JSON.parse(input);
            return { valid: true, data };
        } catch (e: any) {
            return { valid: false, error: e.message };
        }
    }


    public renderTemplate(template: string, data: any): string {
        const result = (new TemplateRenderer()).renderTemplate(template, data);
        return result;
    }

}

class TemplateRenderer {
    //NOTE:PLEASE SYNC RENDER FUNCTION IN FRONEND AND BACKEND

    /**
     * Main entry point - renders template by converting to JS and evaluating once
     */
    renderTemplate(template: string, data: any): string {
        console.debug('=== renderTemplate called ===');
        console.debug('Template:', template);

        // Convert entire template to a single JavaScript expression
        const jsExpression = this.templateToJavaScript(template);

        console.debug('Final JS Expression:', jsExpression);

        // Evaluate once
        const result = this.evaluateExpression(jsExpression, data);

        return this.convertToString(result);
    }


    /**
     * Converts template string to JavaScript expression
     * Replaces all {{...}} with ${...} and wraps in template literal
     */
    templateToJavaScript(template: string): string {
        let position = 0;
        let parts: string[] = [];

        while (position < template.length) {
            const match = this.findNextTemplateExpression(template, position);

            if (match == null) {
                // Add remaining literal text
                if (position < template.length) {
                    parts.push(this.escapeForTemplateLiteral(template.substring(position)));
                }
                break;
            }

            // Add literal text before the expression
            if (match.startIndex > position) {
                parts.push(this.escapeForTemplateLiteral(template.substring(position, match.startIndex)));
            }

            // Process the expression
            let expr = match.expression;

            // ── NEW: transform date(...) / time(...) before anything else ──
            expr = this.transformDateTimeFunctions(expr);

            // Transform nested {{}} to ${} RECURSIVELY
            expr = this.transformNestedTemplates(expr);

            // Add .join('') to array methods
            expr = this.addJoinToArrayMethods(expr);

            // Normalize operators
            expr = expr.replace(/\s!=\s/g, ' !== ');
            expr = expr.replace(/\s==\s/g, ' === ');

            // Add as interpolation
            parts.push('${' + expr + '}');

            // Move past this expression
            position = match.endIndex;
        }

        // Wrap everything in template literal
        return '`' + parts.join('') + '`';
    }



    // ─────────────────────────────────────────────────────────────────────────
    // NEW HELPERS
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Replace date(expr) and time(expr) with the corresponding
     * __formatDate__ / __formatTime__ helper call so the evaluator can run it.
     *
     * Handles the top-level expression only; nested occurrences inside
     * .map() bodies are handled via transformNestedTemplates → convertAllTemplateSyntax
     * which calls this method again through templateToJavaScript.
     */
    transformDateTimeFunctions(expr: string): string {
        // Replace  date(<anything>)  →  __formatDate__(<anything>)
        // Replace  time(<anything>)  →  __formatTime__(<anything>)
        // We use a simple scan so we don't accidentally break nested parens.
        return this.replaceBuiltinCall(this.replaceBuiltinCall(expr, 'date', '__formatDate__'), 'time', '__formatTime__');
    }


    /**
     * Scan `expr` and replace every top-level occurrence of
     *   <fnName>( ... )
     * with
     *   <replacement>( ... )
     * Properly tracks paren depth so nested parens inside the argument are fine.
     */
    private replaceBuiltinCall(expr: string, fnName: string, replacement: string): string {
        let result = '';
        let i = 0;

        while (i < expr.length) {
            // Check for fnName followed immediately by '('
            if (
                expr.substring(i, i + fnName.length) === fnName &&
                expr[i + fnName.length] === '(' &&
                // Make sure it is NOT preceded by a word character (e.g. "mydate(")
                (i === 0 || !/[\w$]/.test(expr[i - 1]))
            ) {
                result += replacement;
                i += fnName.length; // skip the function name; keep the '('
            } else {
                result += expr[i];
                i++;
            }
        }

        return result;
    }



    /**
     * Format a date value (ISO string, timestamp, or Date) as DD-MM-YYYY
     */
    private formatDate(value: any): string {
        const date = value instanceof Date ? value : new Date(value);
        if (isNaN(date.getTime())) return String(value);

        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const year = date.getFullYear();

        return `${day}-${month}-${year}`;
    }

    /**
     * Format a date value as HH:MM AM/PM
     */
    private formatTime(value: any): string {
        const date = value instanceof Date ? value : new Date(value);
        if (isNaN(date.getTime())) return String(value);

        let hours = date.getHours();
        const minutes = String(date.getMinutes()).padStart(2, '0');
        const ampm = hours >= 12 ? 'PM' : 'AM';
        hours = hours % 12;
        hours = hours ? hours : 12; // 0 → 12

        return `${String(hours).padStart(2, '0')}:${minutes} ${ampm}`;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // END NEW HELPERS
    // ─────────────────────────────────────────────────────────────────────────



    /**
     * Transform {{}} to ${} within expressions (for nested templates in arrow functions)
     * Also wraps HTML content in backticks
     */
    transformNestedTemplates(expr: string, depth: number = 0): string {
        if (depth > 10) {
            console.warn('Max depth reached');
            return expr;
        }

        let result = '';
        let i = 0;

        while (i < expr.length) {
            // Look for .map( or .filter(
            if (i < expr.length - 4 && expr[i] === '.' &&
                (expr.substring(i, i + 5) === '.map(' || expr.substring(i, i + 8) === '.filter(')) {

                const isMap = expr.substring(i, i + 5) === '.map(';
                const methodLength = isMap ? 5 : 8;

                result += expr.substring(i, i + methodLength);
                i += methodLength;

                const arrowFunc = this.parseArrowFunction(expr, i);

                if (arrowFunc) {
                    const { param, body, endIndex } = arrowFunc;
                    let transformedBody = body;

                    // Recursively transform the body
                    transformedBody = this.transformNestedTemplates(transformedBody, depth + 1);

                    // Convert {{ }} to ${ }
                    transformedBody = this.convertAllTemplateSyntax(transformedBody);

                    // Convert any '...${...}...' or "...${...}..." to `...${...}...`
                    // This handles ternary branches like: '...<b>${i.name}</b>...'  →  `...<b>${i.name}</b>...`
                    transformedBody = this.convertQuotedStringsToTemplateLiterals(transformedBody);

                    // Wrap any raw-HTML ternary branches in backticks
                    // e.g.  u.active ? <b>${u.name}</b> : <i>${u.name}</i>
                    //     →  u.active ? `<b>${u.name}</b>` : `<i>${u.name}</i>`
                    transformedBody = this.wrapTernaryHtmlBranches(transformedBody);

                    // Decide whether to wrap the ENTIRE body in backticks.
                    // Do it only when the body is a plain HTML/interpolation fragment (starts with <, or is
                    // a single ${...} expression) — NOT when it is executable code like a ternary or a
                    // function call that already has its own backtick strings.
                    const trimmed = transformedBody.trim();
                    const isPlainFragment = trimmed.startsWith('<') ||
                        (trimmed.startsWith('${') && !trimmed.includes('?'));

                    if (isPlainFragment) {
                        result += `${param} => \`${transformedBody}\``;
                    } else {
                        result += `${param} => ${transformedBody}`;
                    }

                    i = endIndex;
                    if (i < expr.length && expr[i] === ')') {
                        result += ')';
                        i++;
                    }
                } else {
                    result += expr[i];
                    i++;
                }
            } else {
                result += expr[i];
                i++;
            }
        }

        // Convert any remaining {{ }} to ${ }
        result = this.convertAllTemplateSyntax(result);

        return result;
    }

    /**
     * Convert all {{ }} to ${ } using proper nesting logic
     */
    convertAllTemplateSyntax(str: string): string {
        let result = '';
        let pos = 0;

        while (pos < str.length) {
            let startIndex = str.indexOf('{{', pos);

            if (startIndex === -1) {
                result += str.substring(pos);
                break;
            }

            // Add everything before {{
            result += str.substring(pos, startIndex);

            // Find matching }}
            let depth = 1;
            let searchPos = startIndex + 2;

            while (searchPos < str.length - 1 && depth > 0) {
                if (str[searchPos] === '{' && str[searchPos + 1] === '{') {
                    depth++;
                    searchPos += 2;
                } else if (str[searchPos] === '}' && str[searchPos + 1] === '}') {
                    depth--;
                    if (depth === 0) {
                        // Found matching }}
                        let innerExpr = str.substring(startIndex + 2, searchPos);
                        // ── NEW: also transform date/time inside nested expressions ──
                        innerExpr = this.transformDateTimeFunctions(innerExpr);
                        result += '${' + innerExpr + '}';
                        pos = searchPos + 2;
                        break;
                    }
                    searchPos += 2;
                } else {
                    searchPos++;
                }
            }

            // If no matching }} found, just add the {{ and continue
            if (depth > 0) {
                result += '{{';
                pos = startIndex + 2;
            }
        }

        return result;
    }


    /**
     * Walk through a string and convert any single- or double-quoted string
     * that contains ${...} into a backtick template literal.
     *   '<b>${i.name}</b>'   →   `<b>${i.name}</b>`
     *   "hello ${x}"         →   `hello ${x}`
     * Strings that do NOT contain ${ are left untouched.
     */
    convertQuotedStringsToTemplateLiterals(str: string): string {
        let result = '';
        let i = 0;

        while (i < str.length) {
            // When we hit a ' or " we collect the whole quoted string
            if (str[i] === "'" || str[i] === '"') {
                const quote = str[i];
                let content = '';
                i++; // skip opening quote

                while (i < str.length && str[i] !== quote) {
                    if (str[i] === '\\' && i + 1 < str.length) {
                        // escaped char – keep as-is
                        content += str[i] + str[i + 1];
                        i += 2;
                    } else {
                        content += str[i];
                        i++;
                    }
                }
                i++; // skip closing quote

                // If the string body contains ${ , re-emit it as a backtick template literal
                if (content.includes('${')) {
                    result += '`' + content + '`';
                } else {
                    // No interpolation – put the original quotes back
                    result += quote + content + quote;
                }
            }
            // Skip over backtick template literals we already produced – don't touch them
            else if (str[i] === '`') {
                result += '`';
                i++;
                while (i < str.length && str[i] !== '`') {
                    if (str[i] === '\\' && i + 1 < str.length) {
                        result += str[i] + str[i + 1];
                        i += 2;
                    } else {
                        result += str[i];
                        i++;
                    }
                }
                if (i < str.length) {
                    result += '`';
                    i++;
                }
            }
            else {
                result += str[i];
                i++;
            }
        }

        return result;
    }


    /**
     * If the body is a ternary (contains a top-level ?), find each branch.
     * Any branch whose trimmed text starts with < (raw HTML) and is not already
     * backtick-wrapped gets wrapped in backticks.  Recurses into branches so
     * nested ternaries (a ? b ? x : y : z) are handled too.
     */
    wrapTernaryHtmlBranches(str: string): string {
        // --- find top-level ? (skip over any strings / template literals) ---
        let questionIdx = -1;
        let i = 0;
        while (i < str.length) {
            const ch = str[i];
            if (ch === '`') {
                i++;
                while (i < str.length && str[i] !== '`') { if (str[i] === '\\') i++; i++; }
                i++;
                continue;
            }
            if (ch === "'" || ch === '"') {
                const q = ch; i++;
                while (i < str.length && str[i] !== q) { if (str[i] === '\\') i++; i++; }
                i++;
                continue;
            }
            if (ch === '?') { questionIdx = i; break; }
            i++;
        }
        if (questionIdx === -1) return str;   // no ternary — nothing to do

        // --- find the matching top-level : (track nested ? to skip inner ternaries) ---
        let colonIdx = -1;
        i = questionIdx + 1;
        let depth = 0;
        while (i < str.length) {
            const ch = str[i];
            if (ch === '`') {
                i++;
                while (i < str.length && str[i] !== '`') { if (str[i] === '\\') i++; i++; }
                i++;
                continue;
            }
            if (ch === "'" || ch === '"') {
                const q = ch; i++;
                while (i < str.length && str[i] !== q) { if (str[i] === '\\') i++; i++; }
                i++;
                continue;
            }
            if (ch === '?') { depth++; i++; continue; }
            if (ch === ':') {
                if (depth === 0) { colonIdx = i; break; }
                depth--;
                i++;
                continue;
            }
            i++;
        }
        if (colonIdx === -1) return str;      // no colon found — malformed, leave alone

        const condition = str.substring(0, questionIdx);
        const truthy = str.substring(questionIdx + 1, colonIdx);
        const falsy = str.substring(colonIdx + 1);

        // Wrap a single branch if it is raw HTML; recurse first so nested ternaries
        // inside the branch are handled before we decide whether to wrap.
        const maybeWrap = (branch: string): string => {
            branch = this.wrapTernaryHtmlBranches(branch);   // recurse
            const trimmed = branch.trim();
            if (trimmed.startsWith('<') && !trimmed.startsWith('`')) {
                const leading = branch.match(/^(\s*)/)![1];
                const trailing = branch.match(/(\s*)$/)![1];
                return leading + '`' + trimmed + '`' + trailing;
            }
            return branch;
        };

        return condition + '?' + maybeWrap(truthy) + ':' + maybeWrap(falsy);
    }


    /**
     * Finds next template expression using manual parsing to handle nested {{}}
     * FIX: Use manual parsing instead of regex to properly find matching {{ }}
     */
    findNextTemplateExpression(
        template: string,
        startFrom: number = 0
    ): TemplateMatchPosition | null {
        // Find the next {{
        let startIndex = template.indexOf('{{', startFrom);
        if (startIndex === -1) {
            return null;
        }

        // Now find the matching }}
        let depth = 1;
        let pos = startIndex + 2;

        while (pos < template.length - 1 && depth > 0) {
            if (template[pos] === '{' && template[pos + 1] === '{') {
                depth++;
                pos += 2;
            } else if (template[pos] === '}' && template[pos + 1] === '}') {
                depth--;
                if (depth === 0) {
                    // Found matching }}
                    const expression = template.substring(startIndex + 2, pos);
                    return {
                        startIndex: startIndex,
                        endIndex: pos + 2,
                        expression: expression.trim()
                    };
                }
                pos += 2;
            } else {
                pos++;
            }
        }

        // No matching }} found
        return null;
    }

    /**
     * Escape backticks, backslashes, and dollar signs for template literal
     */
    escapeForTemplateLiteral(str: string): string {
        return str
            .replace(/\\/g, '\\\\')
            .replace(/`/g, '\\`')
            .replace(/\$/g, '\\$');
    }

    /**
     * Parse arrow function parameters and body
     */
    parseArrowFunction(expr: string, i: number): { param: string, body: string, endIndex: number } | null {
        let pos = i;

        // Skip whitespace
        while (pos < expr.length && /\s/.test(expr[pos])) {
            pos++;
        }

        // Parse parameter(s)
        let param = '';

        if (expr[pos] === '(') {
            // Parenthesized parameter(s): (x) or (x, y)
            let parenDepth = 1;
            param += '(';
            pos++;

            while (pos < expr.length && parenDepth > 0) {
                if (expr[pos] === '(') parenDepth++;
                if (expr[pos] === ')') parenDepth--;
                param += expr[pos];
                pos++;
            }
        } else {
            // Single parameter without parens: x
            while (pos < expr.length && /[\w$]/.test(expr[pos])) {
                param += expr[pos];
                pos++;
            }
        }

        if (!param) return null;

        // Skip whitespace
        while (pos < expr.length && /\s/.test(expr[pos])) {
            pos++;
        }

        // Check for =>
        if (pos >= expr.length - 1 || expr[pos] !== '=' || expr[pos + 1] !== '>') {
            return null;
        }

        pos += 2; // Skip =>

        // Skip whitespace
        while (pos < expr.length && /\s/.test(expr[pos])) {
            pos++;
        }

        // Parse body - find the end of the arrow function body
        let body = '';
        let parenDepth = 1; // We're inside the .map( already
        let braceDepth = 0;
        let inString = false;
        let stringChar = '';
        let inTemplate = false;

        while (pos < expr.length) {
            const char = expr[pos];

            // Handle template literals
            if (char === '`' && (pos === 0 || expr[pos - 1] !== '\\')) {
                if (!inString || stringChar === '`') {
                    inTemplate = !inTemplate;
                    if (inTemplate) {
                        inString = true;
                        stringChar = '`';
                    } else {
                        inString = false;
                        stringChar = '';
                    }
                }
            }
            // Handle other strings
            else if (!inTemplate && (char === '"' || char === "'")) {
                if (!inString) {
                    inString = true;
                    stringChar = char;
                } else if (char === stringChar && expr[pos - 1] !== '\\') {
                    inString = false;
                    stringChar = '';
                }
            }

            // Count parentheses and braces when not in string
            if (!inString) {
                if (char === '(') parenDepth++;
                if (char === ')') {
                    parenDepth--;
                    if (parenDepth === 0) {
                        // Found the closing ) for the outermost .map(
                        break;
                    }
                }
                if (char === '{') braceDepth++;
                if (char === '}') braceDepth--;
            }

            body += char;
            pos++;
        }

        return {
            param: param.trim(),
            body: body.trim(),
            endIndex: pos
        };
    }

    /**
     * Add .join('') to array method chains
     * FIX: Process template literals recursively to handle nested maps inside them
     */
    addJoinToArrayMethods(expr: string): string {
        return this.processMapJoins(expr);
    }

    processMapJoins(expr: string): string {
        let result = '';
        let i = 0;

        while (i < expr.length) {
            // Handle template literals
            if (expr[i] === '`') {
                result += '`';
                i++;

                while (i < expr.length && expr[i] !== '`') {
                    if (expr[i] === '\\' && i + 1 < expr.length) {
                        result += expr[i] + expr[i + 1];
                        i += 2;
                    } else if (expr[i] === '$' && i + 1 < expr.length && expr[i + 1] === '{') {
                        result += '${';
                        i += 2;
                        let braceDepth = 1;
                        let interpolation = '';

                        while (i < expr.length && braceDepth > 0) {
                            if (expr[i] === '{') braceDepth++;
                            if (expr[i] === '}') braceDepth--;

                            if (braceDepth > 0) {
                                interpolation += expr[i];
                            }
                            i++;
                        }

                        // Recursively process the interpolation
                        result += this.processMapJoins(interpolation) + '}';
                    } else {
                        result += expr[i];
                        i++;
                    }
                }

                if (i < expr.length && expr[i] === '`') {
                    result += '`';
                    i++;
                }
            }
            // Look for .map( or .filter(
            else if (i < expr.length - 4 && expr[i] === '.' &&
                (expr.substring(i, i + 5) === '.map(' || expr.substring(i, i + 8) === '.filter(')) {

                const isMap = expr.substring(i, i + 5) === '.map(';
                const methodLength = isMap ? 5 : 8;

                result += expr.substring(i, i + methodLength);
                i += methodLength;

                // Collect the entire argument including nested calls
                let args = '';
                let depth = 1;
                let inString = false;
                let stringChar = '';

                while (i < expr.length && depth > 0) {
                    const char = expr[i];

                    // Handle strings and template literals  
                    if ((char === '"' || char === "'" || char === '`') &&
                        (i === 0 || expr[i - 1] !== '\\')) {
                        if (!inString) {
                            inString = true;
                            stringChar = char;
                        } else if (char === stringChar) {
                            inString = false;
                            stringChar = '';
                        }
                    }

                    if (!inString) {
                        if (char === '(') depth++;
                        if (char === ')') {
                            depth--;
                            if (depth === 0) break;
                        }
                    }

                    args += char;
                    i++;
                }

                // Recursively process the arguments
                args = this.processMapJoins(args);
                result += args + ')';
                i++; // skip the closing )

                // Peek ahead (skip whitespace) to see what follows
                let afterPos = i;
                while (afterPos < expr.length && /\s/.test(expr[afterPos])) {
                    afterPos++;
                }

                const nextChunk = expr.substring(afterPos);
                const chainContinues = nextChunk.startsWith('.map(') || nextChunk.startsWith('.filter(');
                const hasJoin = nextChunk.startsWith('.join');

                // Only add .join('') if the chain does NOT continue with another .map/.filter
                // and .join is not already there
                if (!chainContinues && !hasJoin) {
                    result += `.join('')`;
                }
            } else {
                result += expr[i];
                i++;
            }
        }

        return result;
    }

    /**
   * Evaluate JavaScript expression once.
   * Injects __formatDate__ and __formatTime__ helpers so templates can use them.
   */
    evaluateExpression(expr: string, data: any): any {
        try {
            if (!expr.trim()) return '';

            const dataKeys = Object.keys(data);
            const dataValues = Object.values(data);

            // ── NEW: bind the private helpers so the generated code can call them ──
            const __formatDate__ = this.formatDate.bind(this);
            const __formatTime__ = this.formatTime.bind(this);

            const func = new Function(
                'data',
                '__formatDate__',
                '__formatTime__',
                ...dataKeys,
                `with(data) { return ${expr}; }`
            );

            return func(data, __formatDate__, __formatTime__, ...dataValues);
        } catch (e) {
            console.error('Error evaluating expression:', expr, e);
            //return `Error: ${e}`;
        }
    }

    /**
     * Convert value to string
     */
    convertToString(value: any): string {
        if (Array.isArray(value)) {
            return value.join('');
        } else if (value != null) {
            return String(value);
        } else {
            return '';
        }
    }
}

interface TemplateMatchPosition {
    startIndex: number;     // Where {{ begins
    endIndex: number;       // Where }} ends (exclusive)
    expression: string;     // The content between {{ and }}
}