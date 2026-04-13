import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { AuthTabSyncService } from './core/auth/auth-tab-sync.service';
import { AuthService } from './core/auth/auth.service';
@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet],
  template: `<router-outlet />`,
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
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }
}
