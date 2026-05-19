import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { firstValueFrom, Observable, Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { AppConfigService } from './app-config.service';
import { LoggerService } from './logger/logger.service';

@Injectable({
  providedIn: 'root',
})
export class PushNotificationService {
  private destroy$ = new Subject<void>();
  private logger = inject(LoggerService);
  private publicKey =
    'BC4mAl1kYeRKYtj0udzB1KhD-Hx9KnHjxqGPFGWqM8sCdYjYOZ-RMvWGhmfc6zi5B2i4n_ucZFMaLWR8NuLOZS0'; // Replace with your new public key

  constructor(private http: HttpClient, private config: AppConfigService) {}


  async subscribeToNotifications(sessionId: string): Promise<boolean> {
    try {

      if (Notification.permission === 'granted') {
        return await this.performSubscription(sessionId);
      } else {
          const permission = await Notification.requestPermission();
  
          if (permission === 'granted') {
            return await this.performSubscription(sessionId);
          } else {
            console.warn('User denied or dismissed notification permission');
            return false;
          }
    
      }
    } catch (error) {
      this.logger.error(error, { context: 'PushNotificationService.subscribeToNotifications' });
      return false;
    }
  }


  private async performSubscription(sessionId: string): Promise<boolean> {
    const swRegistration = await navigator.serviceWorker.ready;

    const subscription = await swRegistration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: this.urlB64ToUint8Array(this.publicKey),
    });

    const subJson = subscription.toJSON();

    if (
      !subJson.endpoint ||
      !subJson.keys ||
      !subJson.keys.p256dh ||
      !subJson.keys.auth
    ) {
      this.logger.error(new Error('Invalid subscription: missing required fields'), { context: 'PushNotificationService.performSubscription' });
      return false;
    }

    localStorage.setItem('auth', subJson.keys.auth);

    const headers = new HttpHeaders({
      'Cache-Control': 'no-cache',
      Pragma: 'no-cache',
    });

    return new Promise((resolve) => {
      this.http
        .post(
          `${this.config.baseUrl}shopper/subscribe?t=${Date.now()}`,
          { sessionId, subscription: subJson },
          { headers }
        )
        .pipe(takeUntil(this.destroy$)).subscribe({
          next: (responseData) => {
            resolve(true);
          },
          error: (err) => {
            this.logger.error(err, { context: 'PushNotificationService.performSubscription.subscribe' });
            resolve(false);
          },
          complete: () => {},
        });
    });
  }

  async unsubscribeFromNotifications(): Promise<boolean> {
    try {
      const swRegistration = await navigator.serviceWorker.ready;
      const subscription = await swRegistration.pushManager.getSubscription();
      if (!subscription) {
        console.warn('No existing subscription found.');
        return false;
      }
  
      const unsubscribed = await subscription.unsubscribe();
  
      if (unsubscribed) {
        localStorage.removeItem('auth');
  
        return true;
      } else {
        this.logger.error(new Error('Failed to unsubscribe from push manager.'), { context: 'PushNotificationService.unsubscribeFromNotifications' });
        return false;
      }
    } catch (error) {
      this.logger.error(error, { context: 'PushNotificationService.unsubscribeFromNotifications' });
      return false;
    }
  }
  

  private urlB64ToUint8Array(base64String: string): Uint8Array {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding)
      .replace(/-/g, '+')
      .replace(/_/g, '/');
    const rawData = window.atob(base64);
    return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)));
  }
}
