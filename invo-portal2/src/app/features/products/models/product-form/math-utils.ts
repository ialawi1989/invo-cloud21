import Decimal from 'decimal.js';

// Ported subset of MathHelpers. Uses decimal.js for precision.
// `afterDecimal` is read from CompanyService in the old project; we take it
// as a parameter here or default to 3 so the model has no runtime dependency
// on a global service.
export const MathUtils = {
  add(b: number, c: number, afterDecimal = 3): number {
    const a = new Decimal(b ?? 0);
    const d = new Decimal(c ?? 0);
    return Number(a.add(d).toFixed(afterDecimal));
  },
  multiply(b: number, c: number, afterDecimal = 3): number {
    const a = new Decimal(b ?? 0);
    const d = new Decimal(c ?? 0);
    return Number(a.mul(d).toFixed(afterDecimal));
  },
  division(b: number, c: number, afterDecimal = 3): number {
    const a = new Decimal(b ?? 0);
    const d = new Decimal(c ?? 0);
    return Number(a.div(d).toFixed(afterDecimal));
  },
};
