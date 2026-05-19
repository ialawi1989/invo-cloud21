export interface AppState {
  pageState: PageState,
  cartState: CartState
}

export interface CartState {
  cartState: any
}

export interface PageState {
  [key: string]: any
}
