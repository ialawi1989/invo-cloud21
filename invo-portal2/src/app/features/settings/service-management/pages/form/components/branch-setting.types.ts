/** Shared shape for every per-branch settings sub-component. The
 *  parent form owns the source-of-truth row and re-applies whatever
 *  the sub-component emits back via `(branchChange)`. */
import type {
  BranchServiceModel,
  SurchargeOption,
  PriceLabelOption,
} from '../../../services/service.types';

export interface BranchSettingComponent {
  /** Active branch row to render — owned by the parent form. */
  branch: BranchServiceModel;
  /** Surcharge options for the per-branch "Charge" dropdown. */
  surcharges: SurchargeOption[];
  /** Price-label options for the per-branch "Price" dropdown. */
  priceLabels: PriceLabelOption[];
}
