import { describe, expect, it } from 'vitest';
import { parseFilename } from './reports.service';

describe('parseFilename', () => {
  it('reads the backend header, which has a space after "="', () => {
    expect(parseFilename('attachment; filename= "ProfitAndLoss.pdf"')).toBe('ProfitAndLoss.pdf');
    expect(parseFilename('attachment; filename= "TrialBalanceBasis.xlsx"')).toBe('TrialBalanceBasis.xlsx');
  });
  it('still reads the common forms', () => {
    expect(parseFilename('attachment; filename="a.xlsx"')).toBe('a.xlsx');
    expect(parseFilename('attachment; filename=a.pdf')).toBe('a.pdf');
    expect(parseFilename("attachment; filename*=UTF-8''My%20Report.pdf")).toBe('My Report.pdf');
  });
  it('returns undefined when there is no usable name, so the caller falls back', () => {
    expect(parseFilename(null)).toBeUndefined();
    expect(parseFilename('attachment')).toBeUndefined();
    expect(parseFilename('attachment; filename= ""')).toBeUndefined();
  });
});
