import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { RouterOutlet, NavigationEnd } from '@angular/router';
import { Router } from '@angular/router';
import { Subscription, filter } from 'rxjs';
import { AuthTabSyncService } from './core/auth/auth-tab-sync.service';
import { AuthService } from './core/auth/auth.service';
import { ToastComponent } from './shared/components/toast/toast.component';
@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, ToastComponent],
  template: `
    <router-outlet />
    <app-toast />
  `,
  styles: [`:host { display: block; height: 100vh; }`],
})
export class App implements OnInit, OnDestroy {
  private tabSync = inject(AuthTabSyncService);
  private auth    = inject(AuthService);
  private router  = inject(Router);
  private sub!: Subscription;

  ngOnInit(): void {
    // When another tab logs out, clear this tab's session and redirect
    this.sub = this.tabSync.logout$.subscribe(() => {
      if (!this.auth.isLoggingOut) {
        this.auth.logout();
      }
    });

    // Any successful navigation means the app shell is healthy again, so clear
    // the one-shot reload guard set by the stale-chunk recovery handler — this
    // re-arms it for a future redeploy without ever looping.
    this.sub.add(
      this.router.events
        .pipe(filter((e) => e instanceof NavigationEnd))
        .subscribe(() => sessionStorage.removeItem('chunk-reload')),
    );
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }
}
