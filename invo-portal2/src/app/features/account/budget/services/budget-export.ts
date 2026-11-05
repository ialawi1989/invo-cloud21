import * as XLSX from 'xlsx';

/** Writes the budget sheets (Profit & Loss, Balance Sheet) as one workbook download. */
export function exportBudgetXlsx(fileName: string, sheets: { name: string; rows: (string | number)[][] }[]): void {
  const wb = XLSX.utils.book_new();
  for (const s of sheets) {
    // Excel caps a sheet name at 31 characters and forbids : \ / ? * [ ]
    const name = s.name.replace(/[:\\/?*[\]]/g, ' ').slice(0, 31) || 'Sheet';
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(s.rows), name);
  }
  XLSX.writeFile(wb, `${fileName.replace(/[\\/:*?"<>|]/g, '-') || 'budget'}.xlsx`);
}
