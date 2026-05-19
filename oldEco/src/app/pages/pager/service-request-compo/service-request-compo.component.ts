import { Component, Input, OnDestroy, OnInit, inject } from '@angular/core';
import { LoggerService } from 'src/app/services/logger/logger.service';
import { TranslateModule } from '@ngx-translate/core';
import { Subject, take } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { Invoice } from 'src/app/models/invoice-model';
import { AppServices } from 'src/app/services/appServices';
import { CartService } from 'src/app/services/cartServices/cart.service';
import { ServiceRequestService } from 'src/app/services/serviceRequestServices/serviceRequest.service';

@Component({
  selector: 'app-service-request-compo',
  imports: [
    TranslateModule
  ],
  templateUrl: './service-request-compo.component.html',
  styleUrl: './service-request-compo.component.css'
})
export class ServiceRequestCompoComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  private logger = inject(LoggerService);
  @Input() showContainer = false;

  @Input() branchId: string | any = null;
  @Input() tableId: string | any = null;
  @Input() tableNumber: string | any = null;

  currentRequests: { [key: string]: number } = {};
  requestHistory: number[] = [];
  buttonCooldowns: { [key: string]: number } = {};

  readonly MAX_REQUESTS = 5;
  readonly COOLDOWN_PERIOD = 10 * 60 * 1000; // 10 minutes
  readonly BUTTON_COOLDOWN = 60 * 1000; // 1 minute

  // Storage keys
  private readonly STORAGE_KEY_REQUEST_HISTORY = 'serviceRequest_history';
  private readonly STORAGE_KEY_BUTTON_COOLDOWNS = 'serviceRequest_buttonCooldowns';

  cooldownTimer: any = null;
  buttonTimers: { [key: string]: any } = {};
  buttonCooldownTimes: { [key: string]: number } = {};

  status = {
    show: false,
    type: '',
    message: '',
    subMessage: ''
  };

  requestLimitClass = 'request-limit-info';
  cooldownTimeDisplay = '';


  invoiceData: Invoice = new Invoice();
  services: any = []


  constructor(
    private serviceRequestService: ServiceRequestService,
    private cartService: CartService,
    public appService: AppServices
  ) {

  }

  async ngOnInit() {
    // Load persisted data from localStorage
    this.loadRequestHistory();
    this.loadButtonCooldowns();

    // Restore button timers for any active cooldowns
    this.restoreButtonTimers();

    this.updateRequestLimitUI();

    // Clean up old requests periodically
    setInterval(() => {
      this.cleanupOldRequests();
    }, 5000);

    if (!this.tableNumber || !this.branchId || !this.tableId) {
      await this.getCartInvoiceData();
      this.branchId = this.invoiceData.branchId;
      this.tableId = this.invoiceData.tableId;
      this.tableNumber = this.invoiceData.tableName;
    }

    await this.getNotificationTemplateList();
  }

  /**
   * Load request history from localStorage
   */
  private loadRequestHistory() {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY_REQUEST_HISTORY);
      if (stored) {
        const parsed = JSON.parse(stored);
        // Only load requests that are still within the cooldown period
        const now = Date.now();
        this.requestHistory = parsed.filter((timestamp: number) =>
          now - timestamp < this.COOLDOWN_PERIOD
        );
        // Save the cleaned history back to localStorage
        this.saveRequestHistory();
      } else {
        this.requestHistory = [];
      }
    } catch (error: any) {
      this.logger.error(error?.message, { stack: error?.stack, context: 'ServiceRequestCompoComponent.loadRequestHistory' });
      this.requestHistory = [];
    }
  }

  /**
   * Save request history to localStorage
   */
  private saveRequestHistory() {
    try {
      localStorage.setItem(this.STORAGE_KEY_REQUEST_HISTORY, JSON.stringify(this.requestHistory));
    } catch (error: any) {
      this.logger.error(error?.message, { stack: error?.stack, context: 'ServiceRequestCompoComponent.saveRequestHistory' });
    }
  }

  /**
   * Load button cooldowns from localStorage
   */
  private loadButtonCooldowns() {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY_BUTTON_COOLDOWNS);
      if (stored) {
        this.buttonCooldowns = JSON.parse(stored);
      } else {
        this.buttonCooldowns = {};
      }
    } catch (error: any) {
      this.logger.error(error?.message, { stack: error?.stack, context: 'ServiceRequestCompoComponent.loadButtonCooldowns' });
      this.buttonCooldowns = {};
    }
  }

  /**
   * Save button cooldowns to localStorage
   */
  private saveButtonCooldowns() {
    try {
      localStorage.setItem(this.STORAGE_KEY_BUTTON_COOLDOWNS, JSON.stringify(this.buttonCooldowns));
    } catch (error: any) {
      this.logger.error(error?.message, { stack: error?.stack, context: 'ServiceRequestCompoComponent.saveButtonCooldowns' });
    }
  }

  /**
   * Restore button timers for any cooldowns that are still active
   */
  private restoreButtonTimers() {
    const now = Date.now();
    Object.entries(this.buttonCooldowns).forEach(([serviceId, cooldownTime]) => {
      const timeLeft = this.BUTTON_COOLDOWN - (now - cooldownTime);

      // Only restore timer if cooldown is still active
      if (timeLeft > 0) {
        this.startButtonTimer(serviceId);
      } else {
        // Clean up expired cooldowns
        delete this.buttonCooldowns[serviceId];
      }
    });
    this.saveButtonCooldowns();
  }

  getCartInvoiceData() {
    return new Promise<void>((resolve) => {
      this.cartService.invoiceDataSub$
        .pipe(take(1))
        .pipe(takeUntil(this.destroy$)).subscribe({
          next: (invoiceData: Invoice | null) => {
            if (invoiceData) {
              this.invoiceData = invoiceData;
            }
            resolve();
          },
          error: () => resolve()
        });
    });
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
    if (this.cooldownTimer) {
      clearInterval(this.cooldownTimer);
    }

    Object.values(this.buttonTimers).forEach(timer => {
      if (timer) clearInterval(timer);
    });

    // Save data before component is destroyed
    this.saveRequestHistory();
    this.saveButtonCooldowns();
  }

  canMakeRequest(): boolean {
    const now = Date.now();
    this.requestHistory = this.requestHistory.filter(timestamp =>
      now - timestamp < this.COOLDOWN_PERIOD
    );
    return this.requestHistory.length < this.MAX_REQUESTS;
  }

  canUseButton(serviceType: string): boolean {
    const now = Date.now();
    const lastUsed = this.buttonCooldowns[serviceType];
    return !lastUsed || (now - lastUsed) >= this.BUTTON_COOLDOWN;
  }

  isButtonDisabled(serviceType: string): boolean {
    return !this.canMakeRequest() || !this.canUseButton(serviceType);
  }

  isButtonOnCooldown(serviceType: string): boolean {
    return !this.canUseButton(serviceType);
  }

  getButtonCooldownDisplay(serviceType: string): string {
    return this.buttonCooldownTimes[serviceType] ?
      `${this.buttonCooldownTimes[serviceType]}s` : '';
  }

  addRequestToHistory() {
    this.requestHistory.push(Date.now());
    this.saveRequestHistory();
    this.updateRequestLimitUI();
  }

  setButtonCooldown(serviceType: string) {
    this.buttonCooldowns[serviceType] = Date.now();
    this.saveButtonCooldowns();
    this.startButtonTimer(serviceType);
  }

  startButtonTimer(serviceType: string) {
    if (this.buttonTimers[serviceType]) {
      clearInterval(this.buttonTimers[serviceType]);
    }

    const cooldownStart = this.buttonCooldowns[serviceType];

    this.buttonTimers[serviceType] = setInterval(() => {
      const now = Date.now();
      const timeLeft = this.BUTTON_COOLDOWN - (now - cooldownStart);

      if (timeLeft <= 0) {
        clearInterval(this.buttonTimers[serviceType]);
        delete this.buttonTimers[serviceType];
        delete this.buttonCooldownTimes[serviceType];
        // Remove from persistent storage
        delete this.buttonCooldowns[serviceType];
        this.saveButtonCooldowns();
      } else {
        const seconds = Math.ceil(timeLeft / 1000);
        this.buttonCooldownTimes[serviceType] = seconds;
      }
    }, 1000);
  }

  updateRequestLimitUI() {
    if (this.requestHistory.length >= this.MAX_REQUESTS) {
      this.requestLimitClass = 'request-limit-info blocked';
      this.startCooldownTimer();
    } else if (this.requestHistory.length >= 3) {
      this.requestLimitClass = 'request-limit-info warning';
    } else {
      this.requestLimitClass = 'request-limit-info';
    }
  }

  startCooldownTimer() {
    if (this.cooldownTimer) {
      clearInterval(this.cooldownTimer);
    }

    const oldestRequest = Math.min(...this.requestHistory);
    const cooldownEndTime = oldestRequest + this.COOLDOWN_PERIOD;

    this.cooldownTimer = setInterval(() => {
      const now = Date.now();
      const timeLeft = cooldownEndTime - now;

      if (timeLeft <= 0) {
        clearInterval(this.cooldownTimer);
        this.cooldownTimeDisplay = '';
        this.updateRequestLimitUI();
      } else {
        const minutes = Math.floor(timeLeft / 60000);
        const seconds = Math.floor((timeLeft % 60000) / 1000);
        this.cooldownTimeDisplay = `Next request in: ${minutes}:${seconds.toString().padStart(2, '0')}`;
      }
    }, 1000);
  }

  async callService(serviceType: string, service?: any) {
    // Validate service object exists
    if (!service) {
      this.showStatus('error', '❌ Service not found!', 'Unable to process request');
      return;
    }

    // Check if can make request (overall limit)
    if (!this.canMakeRequest()) {
      this.showStatus('error', '❌ Request limit reached!', 'Please wait before making another request');
      return;
    }

    // Check if this specific button can be used
    if (!this.canUseButton(serviceType)) {
      this.showStatus('error', `❌ ${service.body} button is on cooldown!`, 'Please wait 1 minute between same requests');
      return;
    }

    // Add request to history and set button cooldown
    this.addRequestToHistory();
    this.setButtonCooldown(serviceType);

    const requestId = Date.now();
    this.currentRequests[serviceType] = requestId;

    // Get the service name from the service object
    const serviceName = this.appService.lang === 'ar'
      ? service.translation?.body?.ar || service.body
      : service.body;

    // Show pending status
    this.showStatus('pending', `📞 Calling ${serviceName}...`, `Request sent from Table: ${this.tableNumber}`);

    try {
      // Send the notification immediately
      const res = await this.sendNotificationByBranch(service.id);

      // Check if this is still the current request (in case multiple requests were made)
      if (this.currentRequests[serviceType] === requestId && res) {
        this.showStatus('success', `✅ ${serviceName} is on the way!`, 'ETA: 2-3 minutes');

        // Hide status after 5 seconds
        setTimeout(() => {
          this.hideStatus();
        }, 5000);
      }
    } catch (error: any) {
      this.logger.error(error?.message, { stack: error?.stack, context: 'ServiceRequestCompoComponent.sendNotification' });
      this.showStatus('error', `❌ Failed to send request`, 'Please try again');
    }

    // Vibrate if supported
    if (navigator.vibrate) {
      navigator.vibrate([100, 50, 100]);
    }
  }

  showStatus(type: string, message: string, subMessage: string) {
    this.status = {
      show: true,
      type,
      message,
      subMessage
    };

    if (type === 'error') {
      setTimeout(() => {
        this.hideStatus();
      }, 5000);
    }
  }

  hideStatus() {
    this.status.show = false;
  }

  cleanupOldRequests() {
    const now = Date.now();
    this.requestHistory = this.requestHistory.filter(timestamp =>
      now - timestamp < this.COOLDOWN_PERIOD
    );
    this.saveRequestHistory();
    this.updateRequestLimitUI();
  }

  get requestCount(): number {
    return this.requestHistory.length;
  }

  getNotificationTemplateList() {
    return new Promise<void>(resolve => {
      this.serviceRequestService.getNotificationTemplateList().pipe(takeUntil(this.destroy$)).subscribe({
        next: (data) => {
          if (data) {
            this.services = data;
          }
          resolve();
        },
        error: () => resolve(),
        complete: () => resolve()
      });
    });
  }

  sendNotificationByBranch(serviceId: string) {
    return new Promise<any>((resolve, reject) => {
      this.serviceRequestService.sendNotificationByBranch(
        serviceId,
        this.branchId,
        this.tableId,
        this.tableNumber
      ).pipe(takeUntil(this.destroy$)).subscribe({
        next: (data) => {
          resolve(data);
        },
        error: (error: any) => {
          this.logger.error(error?.message, { stack: error?.stack, context: 'ServiceRequestCompoComponent.notification' });
          reject(error);
        }
      });
    });
  }

  /**
   * Clear all service request history and cooldowns
   * Useful for testing or manual reset
   */
  clearAllData() {
    try {
      this.requestHistory = [];
      this.buttonCooldowns = {};
      this.buttonCooldownTimes = {};
      this.buttonTimers = {};

      localStorage.removeItem(this.STORAGE_KEY_REQUEST_HISTORY);
      localStorage.removeItem(this.STORAGE_KEY_BUTTON_COOLDOWNS);

      if (this.cooldownTimer) {
        clearInterval(this.cooldownTimer);
        this.cooldownTimer = null;
      }

      Object.values(this.buttonTimers).forEach(timer => {
        if (timer) clearInterval(timer);
      });

      this.updateRequestLimitUI();
    } catch (error: any) {
      this.logger.error(error?.message, { stack: error?.stack, context: 'ServiceRequestCompoComponent.clearData' });
    }
  }

}