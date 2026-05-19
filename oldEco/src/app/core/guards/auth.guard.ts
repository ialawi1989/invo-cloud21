import { Injectable } from "@angular/core";
import {
  Router,
  CanActivate,
  ActivatedRouteSnapshot,
  RouterStateSnapshot,
} from "@angular/router";
import { AuthService } from "src/app/services/authService/auth.service";

@Injectable({ providedIn: "root" })
export class AuthGuard implements CanActivate {

  constructor(
    private router: Router,
    private auth: AuthService
  ) { 
    
  }

  async canActivate(route: ActivatedRouteSnapshot, state: RouterStateSnapshot) {
    if (this.auth.isCustomerAuthenticated()) {
      return true;
    } else {
      this.router.navigate(["/"]);
      return false;
    }

  }
}
