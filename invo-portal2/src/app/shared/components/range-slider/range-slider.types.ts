/** Value shape for range mode. */
export interface RangeSliderValue {
  min: number;
  max: number;
}

/** Function that formats a numeric value into a display label. */
export type SliderLabelFormatter = (value: number) => string;
