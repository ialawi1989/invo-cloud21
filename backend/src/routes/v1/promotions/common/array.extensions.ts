// Tell TS we’re extending the Array prototype
export {};

declare global {
  interface Array<T> {
    sum(this: number[]): number;
  }
}

Array.prototype.sum = function (this: number[]) {
  return this.reduce((a, b) => a + b, 0);
};