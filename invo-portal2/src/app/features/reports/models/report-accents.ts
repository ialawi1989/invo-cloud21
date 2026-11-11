/** One accent colour per report group — used wherever the groups are listed (the Reports page, "Browse all reports"). */
const GROUP_ACCENT: Record<string, string> = {
  'business-overview': '#0d9488', sales: '#2563eb', inventory: '#d97706', customer: '#7c3aed', employee: '#db2777',
  suppliers: '#ea580c', tax: '#475569', 'sales-period': '#0891b2', purchase: '#059669', others: '#4f46e5', tables: '#0e7490', attendance: '#be185d', discount: '#c026d3',
};

export const groupAccent = (groupKey: string): string => GROUP_ACCENT[groupKey] ?? '#32acc1';
