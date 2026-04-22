import { Response } from "express";

/**
 * Convert an array of objects to CSV and send as a downloadable file.
 * Handles escaping quotes, commas, and newlines per RFC 4180.
 */
export function sendCsv(res: Response, rows: any[], filename: string): void {
    if (!rows || rows.length === 0) {
        res.setHeader("Content-Type", "text/csv");
        res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
        res.send("");
        return;
    }

    const headers = Object.keys(rows[0]);
    const escape = (val: any): string => {
        if (val === null || val === undefined) return "";
        const str = val instanceof Date ? val.toISOString() : String(val);
        if (str.includes('"') || str.includes(',') || str.includes('\n') || str.includes('\r')) {
            return '"' + str.replace(/"/g, '""') + '"';
        }
        return str;
    };

    const csvLines = [
        headers.join(","),
        ...rows.map(row => headers.map(h => escape(row[h])).join(","))
    ];

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.send("\uFEFF" + csvLines.join("\r\n"));  // BOM for Excel UTF-8 support
}
