import { Injectable } from '@angular/core';
import { Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';

@Injectable({ providedIn: 'root' })
export class NavigationTrackerService {
  private lastValidUrl: string = '/menu'; // default

  constructor(private router: Router) {
    this.router.events.pipe(
      filter(event => event instanceof NavigationEnd)
    ).subscribe((event: NavigationEnd) => {
      const url = (event as NavigationEnd).urlAfterRedirects;

      
      if (url.includes('/menu') || url.includes('/shop')) {
        this.lastValidUrl = url;
      }
    });
  }

  getLastValidUrl(): string {
    return this.lastValidUrl;
  }
}