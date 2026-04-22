import { Request, Response, NextFunction } from "express";
import { PoolClient } from "node_modules/@types/pg";
import { SQL } from "./sql";
import { SortInfo } from "./sortInfo";
import { Exception } from "./exceptions";

export interface PageInfo {
  page: number;
  limit: number;
  count: number;
  startIndex: number;
  lastIndex: number;
}
type PagedResult<T> = { data: T[]; pageInfo?: PageInfo };

export async function includePageInfo<T>(
  req: Request,
  res: Response,
  next: NextFunction,
  func: (req: Request, res: Response, next: any) => Promise<T>
): Promise<T> {
  const raw = req.headers["page-info"]; // header keys are lowercase in Node
  if (!raw) {
    res.locals.pageInfo = undefined;
    return func(req, res, next);
  }

  // Handle string[] vs string
  const json = Array.isArray(raw) ? raw[0] : raw;

  try {
    res.locals.pageInfo = JSON.parse(json) as PageInfo;
    const result = await func(req, res, next);
    setPageInfo(res, res.locals.pageInfo);
    return result;
  } catch (err) {
    console.warn("Invalid pageInfo header:", err);
    return func(req, res, next);
  }
}

export async function includeSortInfo<T>(
  req: Request,
  res: Response,
  next: NextFunction,
  func: (req: Request, res: Response, next: any) => Promise<T>
): Promise<T> {
  const raw = req.headers["sort-info"]; // header keys are lowercase in Node
  if (!raw) {
    res.locals.sortInfo = undefined;
    return func(req, res, next);
  }

  // Handle string[] vs string
  const json = Array.isArray(raw) ? raw[0] : raw;

  try {
    res.locals.sortInfo = JSON.parse(json) as SortInfo;
      if(res.locals.sortInfo.sortDirection)
      {
        if(res.locals.sortInfo.sortDirection == "ASC")
        {
          res.locals.sortInfo.sortDirection = "ASC";
        }
        else
        {
          res.locals.sortInfo.sortDirection = "DESC";
        }
      }
      else
      {
        res.locals.sortInfo.sortDirection = "ASC";
      }
    const result = await func(req, res, next);
    setSortInfo(res, res.locals.sortInfo);
    return result;
  } catch (err) {
    console.warn("Invalid pageInfo header:", err);
    return func(req, res, next);
  }
}

export function resetPageInfo(pageInfo?: PageInfo) {
  if (pageInfo) {
    pageInfo.count = 0;
    pageInfo.page = 1;
  }
}

export function setPageInfo(res: Response, pageInfo?: PageInfo) {
    appendAccessControlExposeHeader(res, "page-info",pageInfo);
}


export function setSortInfo(res: Response, sortInfo?: SortInfo) {
  appendAccessControlExposeHeader(res, "sort-info",sortInfo);
}

export function appendAccessControlExposeHeader(res: Response<any, Record<string, any>>, headerName: string,value?:object) {
    if (!value) return;
  const existing = res.getHeader("Access-Control-Expose-Headers");
  const exposeHeaders = existing
    ? existing.toString() + ", " + headerName
    : headerName;
    res.setHeader("Access-Control-Expose-Headers", exposeHeaders);
    
    res.setHeader(headerName, JSON.stringify(value));
}

export function orderBy(sortValues: {[name:string]:string[] | string}, defaultSortField:string,sortInfo?:SortInfo)
{
    if(!sortInfo ) return "";

      sortInfo.sortValue = sortInfo.sortValue || defaultSortField;
      let sortValue = sortValues[sortInfo.sortValue];
      if(!sortValue)
      {
        throw new Exception(`Sort Field ${sortInfo.sortValue} is not recognized`);
      }
      if(Array.isArray(sortValue))
      return  `--sql
                        ORDER BY ${sortValue.map(v=> v+" "+sortInfo.sortDirection).join(", ")}
              `;
      return `--sql
                        ORDER BY ${sortValue} ${sortInfo.sortDirection}
              `;

}

export async function queryPage<T>(
  client: PoolClient,
  query: SQL,
  pageInfo?: PageInfo
): Promise<T[]> {
  // No pagination -> run as-is
  if (!pageInfo) {
    const { rows } = await client.query(query.text, query.values ?? []);
    return rows;
  }

  const pageSize = Math.max(1, Math.min(pageInfo.limit || 25, 200));
  const requestedPage = Math.max(1, pageInfo.page || 1);

  const requestedOffset = (requestedPage - 1) * pageSize;
  const capRows = (requestedPage + 2) * pageSize; // <-- only count up to (page+2) pages

  const baseText = (query.text ?? "").trim().replace(/;+$/g, "");
  const baseParams = query.values ?? [];

  const pLimit = baseParams.length + 1;
  const pOffset = baseParams.length + 2;
  const pCap = baseParams.length + 3;

  const wrapped = `--sql
    WITH base AS (
      ${baseText}
    ),
    stats AS (
      SELECT
        COUNT(*)::int AS counted,
         ($${pCap}::int) AS cap,
        (COUNT(*)::int >= $${pCap}::int) AS is_capped
      FROM (SELECT 1 FROM base LIMIT $${pCap}::int) x
    ),
    limits AS (
      SELECT
        counted,
        is_capped,
        $${pLimit}::int AS page_limit,
        CASE
      WHEN is_capped THEN
            -- We don't know the real total; don't clamp (use requested offset)
            $${pOffset}::int
      ELSE
            -- last page start: floor((counted - 1)/limit) * limit
            GREATEST(0, LEAST($${pOffset}::int, GREATEST( ((counted - 1) / $${pLimit}::int) * $${pLimit}::int, 0)))
        END AS effective_offset
      FROM stats
    ),
    paged AS (
      ${baseText}
      LIMIT  (SELECT page_limit       FROM limits)
          OFFSET (SELECT effective_offset FROM limits)
    )
    SELECT
      COALESCE((SELECT json_agg(p) FROM paged p), '[]'::json) AS data,
      json_build_object(
        'page',
          CASE WHEN (SELECT counted FROM stats) = 0 THEN 0
              ELSE ((SELECT effective_offset FROM limits) / (SELECT page_limit FROM limits)) + 1
          END,
        'limit',  (SELECT page_limit FROM limits),
        'count',
          CASE
            WHEN (SELECT is_capped FROM stats)
              THEN CEIL(($${pCap}::numeric) / (SELECT page_limit FROM limits))::int  -- lower bound
            ELSE CEIL((SELECT counted FROM stats)::numeric / (SELECT page_limit FROM limits))::int
          END,
        'exact',
          NOT (SELECT is_capped FROM stats)
      ) AS "pageInfo";
  `;

  const params = [...baseParams, pageSize, requestedOffset, capRows];
  const { rows } = await client.query(wrapped, params);

  const data = (rows[0]?.data ?? []) as T[];
  const outInfo = rows[0]?.pageInfo as
    | (PageInfo & { exact?: boolean })
    | undefined;
  if (outInfo) {
    pageInfo.count = outInfo?.count;
    pageInfo.page = outInfo?.page;
    pageInfo.limit = outInfo?.limit;
    pageInfo.startIndex = (pageInfo.page - 1) * pageInfo.limit + 1;
    pageInfo.lastIndex = pageInfo.startIndex + data.length - 1;
  }
  return data;
}
