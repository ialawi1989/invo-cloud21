import { Component, HostListener, Inject, OnInit, PLATFORM_ID } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Notification } from 'src/app/models/notification.model';
import { PushNotificationService } from 'src/app/services/notification.service';
import { isPlatformBrowser, Location } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { Router, RouterModule } from '@angular/router';
import { AppServices } from 'src/app/services/appServices';

@Component({
  selector: 'app-notification-page',
  standalone: true,
  templateUrl: './notification-page.component.html',
  styleUrls: ['./notification-page.component.css'],
  imports: [
    FormsModule, 
    TranslateModule, 
    RouterModule
  ]
})
export class NotificationPageComponent implements OnInit {
  categories = [
    'All', 
    'Orders', 
    'Promotions', 
    'Updates'
  ];
  selectedCategory = 'All';
  
  notifications: Notification[] = !this.appService.isLocalConfig() ? [] : [
    {
      id: 1,
      title: 'Order Shipped',
      description: 'Your order #1234 has been shipped.',
      time: new Date(),
      category: 'Orders',
      read: false,
    },
    {
      id: 2,
      title: 'Big Sale Today!',
      description: 'Up to 50% off on selected items.',
      time: new Date(Date.now() - 1000 * 60 * 30),
      category: 'Promotions',
      read: true,
    },
    {
      id: 4,
      title: 'New Discount Code',
      description: 'Use SAVE10 to get 10% off.',
      time: new Date(Date.now() - 1000 * 60 * 60 * 5),
      category: 'Promotions',
      read: false,
    },
     {
      id: 5,
      title: 'New Discount Code',
      description: 'Use SAVE10 to get 10% off.',
      time: new Date(Date.now() - 1000 * 60 * 60 * 5),
      category: 'Promotions',
      read: false,
    },
     {
      id:6 ,
      title: 'New Discount Code',
      description: 'Use SAVE10 to get 10% off.',
      time: new Date(Date.now() - 1000 * 60 * 60 * 5),
      category: 'Promotions',
      read: false,
    },
     {
      id: 7,
      title: 'New Discount Code',
      description: 'Use SAVE10 to get 10% off.',
      time: new Date(Date.now() - 1000 * 60 * 60 * 5),
      category: 'Promotions',
      read: false,
    },
    {
      id: 3,
      title: 'Shipping',
      description: 'Notifcation page',
      time: new Date(Date.now() - 1000 * 60 * 60 * 2),
      category: 'Updates',
      read: true,
    },
  ];

  isBrowser: boolean;
  canGoBack: boolean = false;

  constructor(
    private notificationService: PushNotificationService, 
    private location: Location, @Inject(PLATFORM_ID) 
    private platformId: any,
    private appService: AppServices,
    private router: Router,
  ) {
    this.isBrowser = isPlatformBrowser(this.platformId);
    this.canGoBack = !!this.router.getCurrentNavigation()?.previousNavigation;
  }

  filteredNotifications: Notification[] = [];
  notificationsEnabled = false;
  ngOnInit(): void {
    this.filterNotifications();
    this.notificationsEnabled = localStorage.getItem('auth') ? true : false

    if (Notification.permission === 'denied') {
      this.notificationsEnabled = false;
      localStorage.removeItem('auth');
    }

  }

  isSmallScreen: boolean = false;

  @HostListener('window:resize')
  onResize() {
    if (this.isMobile()) {
      this.isSmallScreen = true
    } else {
      this.isSmallScreen = false
    }

  }

  selectCategory(category: string): void {
    this.selectedCategory = category;
    this.filterNotifications();
  }

  filterNotifications(): void {
    this.filteredNotifications =
      this.selectedCategory === 'All'
        ? this.notifications
        : this.notifications.filter(
          (n) => n.category === this.selectedCategory
        );
  }

  formatTime(date: Date): string {
    const diff = Date.now() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    if (minutes < 60) return `${minutes} min ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} hr ago`;
    return date.toLocaleDateString();
  }



  async onToggleNotifications() {
    const sessionId = localStorage.getItem('sessionId');
    if (!sessionId) { return }

    if (this.notificationsEnabled) {

      const success = await this.notificationService.subscribeToNotifications(sessionId);
      if (success) {
        this.notificationsEnabled = true;
      } else {
        this.notificationsEnabled = false;
      }
    } else {

      const success = await this.notificationService.unsubscribeFromNotifications();

      if (success) {
        this.notificationsEnabled = false;
      }
    }
  }

  goBack() {
    if (this.canGoBack) {
      this.location.back();
    } else {
      this.router.navigate(['/']);
    }
  }

  isMobile(): boolean {
    if (this.isBrowser) return window.innerWidth < 767; // Adjust the width threshold as needed
    return false
  }
}