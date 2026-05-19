import { createAction, props } from '@ngrx/store';

export const setPageState = createAction(
  '[Page] Set Page State',
  props<{ pageState: any }>()
);
export const getPageState = createAction('[Page] Get State');
export const clearPageState = createAction('[Page] Clear State');


export const setCartState = createAction(
  '[Cart] Set Cart State',
  props<{ cartState: any }>()
);
