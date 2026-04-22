import { DB } from '@src/dbconnection/dbconnection';
import knex, { Knex } from 'knex'; // Import Knex types
import { string } from 'pg-format';

// --- TYPE DEFINITIONS ---
type QueryBuilder = Knex.QueryBuilder;
type FilterValue = any | any[];


type A = Extract<keyof TableConfig['aliasMap'], string>;
type B = Extract<keyof TableConfig['columnMap'], string>;

// Definition of the core configuration structures
interface ColumnDefinition {
    table: A;
    dbCol: string;
    joinRequired?: string;
    jsonKV?: {
        key: string; // UUID or any string key inside the JSON object
        cast?: 'text' | 'int' | 'numeric' | 'boolean' | 'timestamp' | 'date';
    };
    rawExpr?: string;
    jsonPath?: string[];
    jsonArrayPick?: {
        matchKey: 'abbr' | 'name' | string;   // property to match on
        matchValue: string;                    // the value to match (e.g., 'Choose')
        returnKey: 'value' | string;            // which property to return
        cast?: 'text' | 'int' | 'numeric' | 'boolean' | 'timestamp';
    };
    cast?: 'text' | 'numeric' | 'int' | 'boolean' | 'timestamp';
}

interface JoinDefinition { joinTable: A; onLocal: string; onForeign: string; type?: 'LEFT' | 'INNER'; }

export interface Filter {
    column: B;
    operator: 'eq' | 'ne' | 'gt' | 'lt' | 'ge' | 'le' | 'like' | 'in' | 'nin' | 'array_overlap';
    value: FilterValue;
    query?: string;
}

export interface TableConfig {
    aliasMap: { [key: string]: string };
    columnMap: { [key: string]: ColumnDefinition };
    joinDefs: { [key: string]: JoinDefinition };
    searchableColumns: string[];
    selectableColumns?: string[];
}

export interface TableRequest {
    table_name: string;
    select_columns: B[];
    search_term?: string;
    filters?: Filter[];
    sort_by?: B;
    sort_order?: 'ASC' | 'DESC';
    page_number?: number;
    page_size?: number;
}

export interface PagedData<T> {
    data: T[];
    total_count: number;
    page_size: number;
    page_number: number;
}





function getKnexQuery(knexQuery: Knex.QueryBuilder | Knex.Raw<any>): { text: string; values: any[] } {
    const { sql, bindings } = knexQuery.toSQL();

    // Replace ? with $1, $2, $3...
    let index = 0;
    const pgSql = sql.replace(/\?/g, () => `$${++index}`);

    return {
        text: pgSql,
        values: bindings as any[],
    };

}

function qIdent(s: string): string {
    // 1) trim
    let t = (s ?? '').trim();
    // 2) strip any surrounding quotes the caller might have added
    t = t.replace(/^"+|"+$/g, '');
    // 3) escape internal quotes (defensive)
    t = t.replace(/"/g, '""');
    // 4) wrap once
    return `"${t}"`;
}

function normalizeRefToRefString(ref: string): string {
    // handles: p.categoryId | p."categoryId" | "p".categoryId | "p"."categoryId"
    const t = (ref ?? '').trim();

    const dot = t.indexOf('.');
    if (dot < 0) return t.replace(/^"+|"+$/g, ''); // no dot, best effort

    const table = t.slice(0, dot).replace(/^"+|"+$/g, '').replace(/""/g, '"');
    const col = t.slice(dot + 1).replace(/^"+|"+$/g, '').replace(/""/g, '"');

    return `${table}.${col}`; // unquoted, perfect for onRef()
}

// --- FILTER OPERATOR MAP ---

type FilterApplier = (query: QueryBuilder, dbColumn: string, value: FilterValue) => QueryBuilder;

const createFilterOperatorMap = (): Record<Filter['operator'], FilterApplier> => ({
    eq: (q, col, val) => q.where(col, '=', val),
    ne: (q, col, val) => q.where(col, '<>', val),
    gt: (q, col, val) => q.where(col, '>', val),
    ge: (q, col, val) => q.where(col, '>=', val),
    lt: (q, col, val) => q.where(col, '<', val),
    le: (q, col, val) => q.where(col, '<=', val),

    like: (q, col, val) => {
        const v = String(val ?? '').trim();
        if (!v) return q;
        return q.where(col, 'ILIKE', `%${v}%`);
    },

    in: (q, col, val) => {
        const arr = Array.isArray(val) ? val : [val];
        const clean = arr
            .map(v => (v !== null && v !== undefined) ? String(v) : null)
            .filter((v): v is string => v !== null);

        // if user passed [] => don't filter
        if (arr.length === 0) return q;

        // if user passed [null] or all nulls => no rows
        if (clean.length === 0) return q.whereRaw('1=0');

        return q.whereIn(col, clean);
    },

    nin: (q, col, val) => {
        const arr = Array.isArray(val) ? val : [val];
        const clean = arr
            .map(v => (v !== null && v !== undefined) ? String(v) : null)
            .filter((v): v is string => v !== null);

        // if user passed [] => don't filter
        if (arr.length === 0) return q;

        // if user passed [null] or all nulls => don't exclude anything
        if (clean.length === 0) return q;

        return q.whereNotIn(col, clean);
    },

    array_overlap: (q, col, val) => {
        const arr = Array.isArray(val) ? val : [val];
        const clean = arr
            .map(v => (v !== null && v !== undefined) ? String(v) : null)
            .filter((v): v is string => v !== null);

        if (clean.length === 0) return q;

        return q.whereRaw(`?? && ?::text[]`, [col, `{${clean.join(',')}}`]);
    },
});

export class TableDataService {
    // The database instance is now explicitly typed as Knex
    private db: Knex = knex({ client: 'pg' });


    private readonly ALIAS_MAP: { [key: string]: string };
    private readonly COLUMN_MAP: { [key: string]: ColumnDefinition };
    private readonly JOIN_DEFS: { [key: string]: JoinDefinition };
    private readonly SEARCHABLE_COLUMNS: string[];
    private readonly SELECTABLE_COLUMNS: string[];
    private readonly FILTER_OPERATOR_MAP = createFilterOperatorMap();

    // Constructor accepts Knex instance and configuration
    constructor(config: TableConfig) {
        this.ALIAS_MAP = config.aliasMap;
        this.COLUMN_MAP = config.columnMap;
        this.JOIN_DEFS = config.joinDefs;
        this.SEARCHABLE_COLUMNS = config.searchableColumns;
        this.SELECTABLE_COLUMNS = config.selectableColumns ?? [];
    }

    // ... (getRequiredJoins method remains the same, using 'this.' for maps) ...
    private getRequiredJoins(request: TableRequest): Set<string> {
        const requiredJoins = new Set<string>();
        const columnMap = this.COLUMN_MAP;

        // Check columns in SELECT, SORT, SEARCH, and FILTERS
        [...request.select_columns, request.sort_by].filter(Boolean).forEach(col => {
            if (columnMap[col as string]?.joinRequired) {
                requiredJoins.add(columnMap[col as string].joinRequired!);
            }
        });

        request.filters?.forEach(f => {
            if (columnMap[f.column]?.joinRequired) {
                requiredJoins.add(columnMap[f.column].joinRequired!);
            }
        });



        return requiredJoins;
    }

    public exprFor(def: ColumnDefinition): string {
        const q = (s: string) => `"${s}"`;
        if (def.rawExpr) {
            return `(${def.rawExpr})`;
        }
        // --- NEW: JSON key-value pattern { id: value } ---
        if (def.jsonKV) {
            const key = def.jsonKV.key.replace(/'/g, "''"); // basic escape for literal
            let expr = `${qIdent(def.table)}.${qIdent(def.dbCol)} ->> '${key}'`; // text

            switch (def.jsonKV.cast) {
                case 'int': expr = `(${expr})::int`; break;
                case 'numeric': expr = `(${expr})::numeric`; break;
                case 'boolean': expr = `(${expr})::boolean`; break;
                case 'timestamp': expr = `(${expr})::timestamp`; break;
                case 'date': expr = `(${expr})::date`; break;
                case 'text':
                default: /* already text */ break;
            }
            return expr;
        }

        // legacy jsonArrayPick (array of objects)
        // if (def.jsonArrayPick) {
        //     const jp = def.jsonArrayPick;
        //     const matchKey = jp.matchKey.replace(/"/g, '""');
        //     const matchVal = jp.matchValue.replace(/'/g, "''");
        //     const returnKey = jp.returnKey.replace(/"/g, '""');

        //     let sub =
        //         `(SELECT e->>'${returnKey}'
        //       FROM jsonb_array_elements(${def.table}.${q(def.dbCol)}) AS e
        //       WHERE e->>'${matchKey}' = '${matchVal}'
        //       LIMIT 1)`;

        //     switch (jp.cast) {
        //         case 'int': sub = `(${sub})::int`; break;
        //         case 'numeric': sub = `(${sub})::numeric`; break;
        //         case 'boolean': sub = `(${sub})::boolean`; break;
        //         case 'timestamp': sub = `(${sub})::timestamp`; break;
        //         case 'text':
        //         default: /* text */ break;
        //     }
        //     return sub;
        // }

        // // legacy jsonPath (object path)
        // if (def.jsonPath && def.jsonPath.length > 0) {
        //     const path = def.jsonPath.map(p => p.replace(/"/g, '""')).join(',');
        //     let expr = `${def.table}.${q(def.dbCol)} #>> '{${path}}'`; // text
        //     switch (def.cast) {
        //         case 'numeric': expr = `(${expr})::numeric`; break;
        //         case 'int': expr = `(${expr})::int`; break;
        //         case 'boolean': expr = `(${expr})::boolean`; break;
        //         case 'timestamp': expr = `(${expr})::timestamp`; break;
        //         case 'text':
        //         default: break;
        //     }
        //     return expr;
        // }

        // plain column
        let expr = `${qIdent(def.table)}.${qIdent(def.dbCol)}`;
        switch (def.cast) {
            case 'numeric': expr = `(${expr})::numeric`; break;
            case 'int': expr = `(${expr})::int`; break;
            case 'boolean': expr = `(${expr})::boolean`; break;
            case 'timestamp': expr = `(${expr})::timestamp`; break;
            case 'text':
            default: break;
        }
        return expr;
    }

    public async getTableData<T>(request: TableRequest): Promise<PagedData<T>> {
        const {
            table_name, select_columns, search_term, filters,
            sort_by, sort_order = 'ASC',
            page_number = 1, page_size = 25
        } = request;

        const baseAlias = Object.keys(this.ALIAS_MAP).find(key => this.ALIAS_MAP[key] === table_name);
        if (!baseAlias) throw new Error(`Base alias not found for table "${table_name}". Check aliasMap.`);

        const requiredJoins = this.getRequiredJoins(request);
        const finalSelectCols: string[] = [];

        // --- Whitelist enforcement ---
        const whitelist = this.SELECTABLE_COLUMNS ?? Object.keys(this.COLUMN_MAP);

        // select whitelist
        for (const col of select_columns) {
            if (!whitelist.includes(col)) {
                throw new Error(`Column "${col}" is not allowed for selection.`);
            }
        }
        // sort whitelist (if provided)
        if (sort_by && !whitelist.includes(sort_by)) {
            throw new Error(`Sorting by "${sort_by}" is not allowed.`);
        }
        // filters whitelist (if provided)
        (filters ?? []).forEach(f => {
            if (!whitelist.includes(f.column)) {
                throw new Error(`Filtering by "${f.column}" is not allowed.`);
            }
        });

        // --- 1) SELECT list (JSON-aware) ---
        for (const key of select_columns) {
            const def = this.COLUMN_MAP[key];
            if (!def) throw new Error(`Unknown select column "${key}"`);
            const expr = this.exprFor(def);
            finalSelectCols.push(`${expr} AS "${key}"`);
        }

        // --- 2) Base query ---
        const baseName = table_name.trim();
        const baseRef = baseName.startsWith('(')
            ? this.db.raw(`${baseName} AS ${qIdent(baseAlias)}`)
            : this.db.raw(`${qIdent(baseName)} AS ${qIdent(baseAlias)}`);

        let baseQuery: QueryBuilder = this.db
            .table(baseRef as any)
            .select(this.db.raw(finalSelectCols.join(', ')));

        // --- 3) Joins ---
        requiredJoins.forEach(joinKey => {
            const joinDef = this.JOIN_DEFS[joinKey];
            if (!joinDef) throw new Error(`Join def "${joinKey}" not found`);

            const joinedTable = this.ALIAS_MAP[joinDef.joinTable];
            if (!joinedTable) throw new Error(`Alias "${joinDef.joinTable}" not mapped to a real table`);

            const onLocal = normalizeRefToRefString(joinDef.onLocal);
            const onForeign = normalizeRefToRefString(joinDef.onForeign);

            // ✅ if aliasMap value is a subquery, use raw
            const jt = joinedTable.trim();
            const tableRef: any = jt.startsWith('(')
                ? this.db.raw(`${jt} AS ${qIdent(joinDef.joinTable)}`) // (SELECT...) AS "bla"
                : this.db.raw(`${qIdent(jt)} AS ${qIdent(joinDef.joinTable)}`); // "Billings" AS "bl"

            const joinType = (joinDef.type ?? 'LEFT').toUpperCase();

            if (joinType === 'INNER') {
                baseQuery = (baseQuery as any).join(tableRef, function (this: Knex.JoinClause) {
                    this.on(onLocal, '=', onForeign);
                });
            } else {
                baseQuery = (baseQuery as any).leftJoin(tableRef, function (this: Knex.JoinClause) {
                    this.on(onLocal, '=', onForeign);
                });
            }
        });

        // --- 4) Filters (JSON-aware) ---
        if (filters && filters.length > 0) {
            filters.forEach(filter => {
                const def = this.COLUMN_MAP[filter.column];
                if (!def) throw new Error(`Unknown filter column "${filter.column}"`);

                const expr = this.exprFor(def);

                // If expression is not a plain identifier, prefer whereRaw with bindings
                // (works for both normal and json exprs)
                const op = filter.operator;
                const val = filter.value;

                if (filter.query) {
                    baseQuery = baseQuery.whereRaw(filter.query, val);
                } else if (op === 'like') {
                    baseQuery = baseQuery.whereRaw(`${expr} ILIKE ?`, [`%${String(val ?? '')}%`]);
                } else if (op === 'in') {
                    const arr = Array.isArray(val) ? val : [val];
                    const clean = arr.filter(v => v !== null && v !== undefined);
                    if (clean.length === 0) baseQuery = baseQuery.whereRaw('1=0');
                    else baseQuery = baseQuery.whereRaw(`${expr} = ANY(?)`, [clean]);
                } else if (op === 'nin') {
                    const arr = Array.isArray(val) ? val : [val];
                    const clean = arr.filter(v => v !== null && v !== undefined);
                    if (clean.length > 0) baseQuery = baseQuery.whereRaw(`NOT (${expr} = ANY(?))`, [clean]);
                } else if (op === 'eq') {
                    baseQuery = baseQuery.whereRaw(`${expr} = ?`, [val]);
                } else if (op === 'ne') {
                    baseQuery = baseQuery.whereRaw(`${expr} <> ?`, [val]);
                } else if (op === 'gt') {
                    baseQuery = baseQuery.whereRaw(`${expr} > ?`, [val]);
                } else if (op === 'lt') {
                    baseQuery = baseQuery.whereRaw(`${expr} < ?`, [val]);
                } else if (op === 'ge') {
                    baseQuery = baseQuery.whereRaw(`${expr} >= ?`, [val]);
                } else if (op === 'le') {
                    baseQuery = baseQuery.whereRaw(`${expr} <= ?`, [val]);
                } else {
                    // Fallback: if you ever add more ops, map them here
                    throw new Error(`Unsupported operator "${op}"`);
                }
            });
        }

        // --- 5) Search (use configured searchable columns; not limited to selected columns) ---
        const searchableKeys = (this.SEARCHABLE_COLUMNS || []).filter(k => !!this.COLUMN_MAP[k]);
        if (search_term && searchableKeys.length) {
            baseQuery = baseQuery.where((builder: any) => {
                searchableKeys.forEach(k => {
                    const d = this.COLUMN_MAP[k];
                    const expr = this.exprFor(d);
                    builder.orWhereRaw(`${expr} ILIKE ?`, [`%${search_term}%`]);
                });
            });
        }

        // --- 6) Count ---
        const countQuery = baseQuery.clone()
            .clearSelect()
            .clearOrder()
            .count<{ total_count: string }>({ total_count: '*' });

        const countSQL = getKnexQuery(countQuery);
        const countResult = await DB.excu.query(countSQL.text, countSQL.values);
        const total_count: number = parseInt(String(countResult?.rows?.[0]?.total_count ?? 0), 10);

        // --- 7) Data (sorting + pagination) ---
        let dataQuery = baseQuery.clone();

        if (sort_by) {
            const sd = this.COLUMN_MAP[sort_by];
            if (!sd) throw new Error(`Unknown sort column "${sort_by}"`);
            const sortExpr = this.exprFor(sd);
            // orderByRaw to support json expressions
            dataQuery = dataQuery.orderByRaw(`${sortExpr} ${sort_order}`);
        }

        const offset = (page_number - 1) * page_size;
        dataQuery = dataQuery.limit(page_size).offset(offset);
        console.log(dataQuery)
        const dataSQL = getKnexQuery(dataQuery);
             console.log(dataSQL.text)
        const dataResult = await DB.excu.query(dataSQL.text, dataSQL.values);
        const data: T[] = dataResult?.rows ?? [];

        return {
            data,
            total_count,
            page_size,
            page_number
        };
    }
}