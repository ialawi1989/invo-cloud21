import { createFeatureSelector, createSelector } from "@ngrx/store";
import { AppState, CartState } from "./app.state";

export const selectAppState = (state: AppState) => state.pageState;

export const selectPageState = createSelector(
  selectAppState,
  (pageState) => {
    return pageState
  }
);


export const selectCartState = (state: AppState) => state.cartState;

export const selectCartData = createSelector(
  selectCartState,
  (state: CartState) => ({ cartState: state.cartState })
);
