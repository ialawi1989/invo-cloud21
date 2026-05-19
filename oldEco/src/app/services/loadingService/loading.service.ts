import { isPlatformBrowser } from '@angular/common';
import { Inject, Injectable, PLATFORM_ID } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class LoadingService {

  isBrowser: boolean;

  constructor(
    @Inject(PLATFORM_ID) private platformId: any,
  ) {
    this.isBrowser = isPlatformBrowser(this.platformId);
  }

  private loadingSubject = new BehaviorSubject<boolean>(false);
  loadingChange$ = this.loadingSubject.asObservable(); // Expose the observable

  showLoadingSpinner() {
    this.loadingSubject.next(true);
    if (this.isBrowser) {
      document.body.style.overflow = 'hidden';
    }
  }

  hideLoadingSpinner() {
    this.loadingSubject.next(false);
    if (this.isBrowser) {
      document.body.style.overflow = 'auto';
    }
  }
}