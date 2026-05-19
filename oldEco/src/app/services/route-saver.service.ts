import {
  RouteReuseStrategy,
  ActivatedRouteSnapshot,
  DetachedRouteHandle,
} from '@angular/router';
import { Inject, Injectable, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

@Injectable({ providedIn: 'root' })
export class CustomRouteReuseStrategy implements RouteReuseStrategy {
  isBrowser: boolean;
  private storedRoutes = new Map<
    string,
    { handle: DetachedRouteHandle; params: any; queryParams: any }
  >();

  constructor(@Inject(PLATFORM_ID) private platformId: any) {
    this.isBrowser = isPlatformBrowser(this.platformId);
  }

  shouldDetach(route: ActivatedRouteSnapshot): boolean {
    const path = route.routeConfig?.path ?? '';

    // ❌ Never cache product pages
    if (path.includes('product') || this.isProductRoute(route)) {
      return false;
    }

    const cacheEnabledRoutes = ['', 'menu', 'shop', 'collections'];
    const basePath = path.split('/')[0];
    const shouldCache = cacheEnabledRoutes.includes(basePath);

    return shouldCache;
  }

  store(route: ActivatedRouteSnapshot, handle: DetachedRouteHandle | null): void {
    const path = route.routeConfig?.path ?? '';
    if (handle) {
      this.storedRoutes.set(path, {
        handle,
        params: route.params,
        queryParams: route.queryParams,
      });
    }
  }

  shouldAttach(route: ActivatedRouteSnapshot): boolean {
    const path = route.routeConfig?.path ?? '';

    // ❌ Never reattach product pages
    if (path.includes('product')) {
      return false;
    }

    const stored = this.storedRoutes.get(path);

    if (stored) {
      const paramsChanged = JSON.stringify(stored.params) !== JSON.stringify(route.params);
      const queryChanged = JSON.stringify(stored.queryParams) !== JSON.stringify(route.queryParams);

      if (paramsChanged || queryChanged) {
        this.storedRoutes.delete(path);
        return false;
      }

      return true;
    }

    return false;
  }

  retrieve(route: ActivatedRouteSnapshot): DetachedRouteHandle | null {
    const path = route.routeConfig?.path ?? '';
    const stored = this.storedRoutes.get(path);
    return stored?.handle ?? null;
  }

  shouldReuseRoute(future: ActivatedRouteSnapshot, curr: ActivatedRouteSnapshot): boolean {
    // 🚫 Never reuse product routes - always create fresh component
    if (this.isProductRoute(future)) {
      return false;
    }

    // If route config differs, do not reuse
    if (future.routeConfig !== curr.routeConfig) {
      return false;
    }

    // If navigating to same route config but with different params, do not reuse
    const paramsChanged = JSON.stringify(future.params) !== JSON.stringify(curr.params);
    if (paramsChanged) {
      return false;
    }

    return true;
  }

  private isProductRoute(route: ActivatedRouteSnapshot): boolean {
    // Check current route
    if (route.routeConfig?.path?.includes('product')) {
      return true;
    }
    // Check parent routes in case product is a child route
    if (route.parent) {
      return this.isProductRoute(route.parent);
    }
    return false;
  }
}