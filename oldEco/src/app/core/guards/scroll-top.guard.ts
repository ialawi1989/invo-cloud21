import { Injectable, Inject, PLATFORM_ID } from "@angular/core";
import { CanActivate } from "@angular/router";
import { isPlatformBrowser } from "@angular/common";

@Injectable({
  providedIn: 'root'
})
export class ScrollTopGuard implements CanActivate {

  constructor(@Inject(PLATFORM_ID) private platformId: Object) {}

  canActivate(): boolean {
    if (isPlatformBrowser(this.platformId)) {
      window.scrollTo({ top: 0 });
    }
    return true; // Allow the route to be activated
  }
}
