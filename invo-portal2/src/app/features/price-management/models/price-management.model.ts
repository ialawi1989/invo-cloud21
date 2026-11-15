/** Weekly repeat days - the legacy `repeatDays` object, key names unchanged (saved as-is). */
export interface RepeatDays {
  saturday: boolean; sunday: boolean; monday: boolean; tuesday: boolean; wednesday: boolean; thursday: boolean; friday: boolean;
}

export type RepeatType = 'Once' | 'Daily' | 'Weekly';

export const WEEK_DAYS: (keyof RepeatDays)[] = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

export const emptyRepeatDays = (): RepeatDays => ({
  saturday: false, sunday: false, monday: false, tuesday: false, wednesday: false, thursday: false, friday: false,
});

/** A row of `product/getPriceManagementList`. */
export interface PriceManagementRow {
  id: string;
  title: string;
  repeat: string;
  priceLabelId: string;
  branchIds: { branchId: string }[];
  fromDate: string;
  toDate: string;
  fromTime: string;
  toTime: string;
  chargeId: string | null;
  discountId: string | null;
  discountName: string | null;
  chargeName: string | null;
}

export interface PriceManagementListParams {
  page?: number;
  limit?: number;
  searchTerm?: string;
  sortBy?: { sortValue: string; sortDirection: string };
}

export interface PriceManagementListResult { list: PriceManagementRow[]; count: number; pageCount: number; }

/** The editable price-management record (`product/getPriceManagement/:id` -> `product/savePriceManagement`). */
export interface PriceManagement {
  id: string;
  title: string;
  repeat: RepeatType | '';
  priceLabelId: string;
  branchIds: { branchId: string }[];
  fromDate: Date;
  toDate: Date;
  /** `HH:mm:ss` on the wire. */
  fromTime: string;
  toTime: string;
  discountId: string;
  chargeId: string;
  repeatDays: RepeatDays;
}

export interface Option { id: string; name: string; }
