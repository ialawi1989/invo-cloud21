// db/sql-loader.ts
import { readFile } from "node:fs/promises";
import path from "node:path";

const cache = new Map<string, string>();

export async function loadSql(relPath: string) {
  let rootDirectory = path.dirname(__dirname)
  const sqlPath = process.env.SQL_PATH ?? '/current/sql';
  const abs = path.join(rootDirectory, sqlPath, relPath);
  if (cache.has(abs)) return cache.get(abs)!;
  const text = await readFile(abs, "utf8");
  cache.set(abs, text);
  return text;
}
