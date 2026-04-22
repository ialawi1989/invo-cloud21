import { CouponSet } from "../coupon.modal";

export interface  DiscountCouponSet extends CouponSet {
  minimumOrder: number;
  percentage: number;
}

export const DiscountCouponSet = "DISCOUNT_COUPON";
