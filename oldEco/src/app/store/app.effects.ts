import { inject, Injectable } from "@angular/core";
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { setCartState, setPageState } from "./app.actions";
import { tap } from "rxjs";

@Injectable({
  providedIn: 'root'
})
export class AppEffects {
  private actions$ = inject(Actions)

  constructor() {
  }

  setPageState$ = createEffect(
    () =>
      this.actions$.pipe(
        ofType(setPageState),
        tap(() => {
        })
      ),
    { dispatch: false }
  );



  setCartState$ = createEffect(
    () =>
      this.actions$.pipe(
        ofType(setCartState),
        tap(() => {
        })
      ),
    { dispatch: false }
  );


}
