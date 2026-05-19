import { createReducer, on } from "@ngrx/store";
import { clearPageState, getPageState, setCartState, setPageState } from "./app.actions";
import { CartState, PageState } from "./app.state";


export const initialState: PageState = {
  // Initialize with any default values if needed
};

export const pageStateReducer = createReducer(
  initialState,
  on(setPageState, (state, { pageState }) => ({
    ...state,
    ...pageState, // Spread the incoming pageState into the current state
  })),
  on(getPageState, (state) => {
    return state;
  }),
  on(clearPageState, (state) => {
    return { ...state, pageState: {} };
  })
);


export const initialCartState: CartState = {
  cartState: null
};


export const cartStateReducer = createReducer(
  initialCartState,

  on(setCartState, (state, { cartState }) => ({
    ...state,
    cartState, // Update the companySettings in the state
  })),

);
