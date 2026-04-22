import { Coupon } from "../../coupon.modal";

export interface  DiscountCoupon extends Coupon {
  minimumOrder: number;
  percentage: number;
}

export const DiscountCoupon = "DISCOUNT_COUPON";
