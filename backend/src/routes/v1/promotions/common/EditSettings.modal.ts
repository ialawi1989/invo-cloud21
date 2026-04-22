import { TranslatedString } from "../promotions.model";

export interface EditSettings<T> {
  setting: T;
  reason: TranslatedString;
  note?: string;
}
