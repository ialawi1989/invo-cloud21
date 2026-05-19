import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { AppState } from '../store/app.state';
import { Store } from '@ngrx/store';

@Injectable({ providedIn: 'root' })
export class PageStateService {
  private cachedStates: Map<string, any> = new Map();
  constructor(
    private store: Store<AppState>,
    private router: Router,) { }

  savePageState(pageState: any, classes: any) {
    pageState.classes = classes;
    this.cachedStates.set(pageState.pageId, pageState);
  }

  getStatesSize(): any | undefined {
    return this.cachedStates.size
  }
  getPageState(pageId: string): any | undefined {
    // console.log(this.cachedStates)
    // console.log(this.cachedStates.get(pageId))
    // console.log([...this.cachedStates.keys()]); // Log all keys
    return this.cachedStates.get(pageId);
  }

  removePageState(pageId: string) {
    this.cachedStates.delete(pageId);
  }

  generateUniquePageId(): string {
    // Extract the page name from the current route
    let currentRoute = this.router.routerState.snapshot.root;

    // Traverse the route tree to find the active route
    let pageName = '';
    while (currentRoute.firstChild) {
      currentRoute = currentRoute.firstChild;
    }

    // Use the route's path or the last segment for the page name
    if (currentRoute && currentRoute.routeConfig) {
      pageName = currentRoute.routeConfig.path || '**';
    }

    return pageName; // Return the page name as the unique identifier
  }

  mapClasses(element: HTMLElement): any {
    const classData: any = {
      className: element.className,
      children: []
    };

    for (const child of Array.from(element.children)) {
      classData.children.push(this.mapClasses(child as HTMLElement));
    }

    return classData;
  }
}
