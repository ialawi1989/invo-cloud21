// add-to-compare-button.component.ts
import { Component, Input, Inject, PLATFORM_ID, inject, OnDestroy} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Product } from '../../../models/product.model';
import { Router, RouterLink } from '@angular/router';
import { CompareService } from 'src/app/services/compare/compare.service';
import { TranslateModule } from '@ngx-translate/core';
import { LoggerService } from 'src/app/services/logger/logger.service';

@Component({
  selector: 'app-add-to-compare-button',
  templateUrl: './add-to-compare-button.html',
  styleUrl: './add-to-compare-button.css',
  imports: [RouterLink, TranslateModule],
})
export class AddToCompareButtonComponent implements OnDestroy {
  private destroy$ = new Subject<void>();
  private logger = inject(LoggerService);
  @Input() product!: Product;
  @Input() showText: boolean = true;
  @Input() size: 'sm' | 'md' | 'lg' = 'sm';

  isBrowser: boolean;
  isInCompare: boolean = false;
  isCompareFull: boolean = false;
  compareCount: number = 0;
  isLoading: boolean = false;

  constructor(
    @Inject(PLATFORM_ID) private platformId: any,
    private compareService: CompareService,
    private router: Router
  ) {
    this.isBrowser = isPlatformBrowser(this.platformId);
  }

  ngOnInit() {
    if (!this.product) {
      this.logger.error('Product is required for AddToCompareButtonComponent', { context: 'AddToCompareButtonComponent.ngOnInit' });
      return;
    }

    // Subscribe to compare items changes
    this.compareService.getCompareItems().subscribe(items => {
      this.isInCompare = this.compareService.isInCompare(this.product.id);
      this.isCompareFull = this.compareService.isCompareFull();
      this.compareCount = this.compareService.getCompareCount();
    });
  }

  async toggleCompare() {
    if (this.isLoading || !this.product) return;

    this.isLoading = true;

    try {
      if (this.isInCompare) {
        // Remove from compare
        const success = await this.compareService.removeFromCompare(this.product.id);
        if (success) {
          this.showToast('Product removed from compare list', 'info');
        }
      } else {
        // Add to compare
        if (this.isCompareFull) {
          this.showToast(`Maximum ${this.compareService['maxCompareItems'] || 4} items allowed for comparison`, 'warning');
          return;
        }

        const success = await this.compareService.addToCompare(this.product);
        if (success) {
          this.showToast('Product added to compare list', 'success');

          // If this is the second item, show suggestion to view compare page
          if (this.compareService.getCompareCount() === 2) {
            this.showComparePageSuggestion();
          }
        } else {
          this.showToast('Product already in compare list', 'info');
        }
      }
    } catch (error: any) {
      this.logger.error(error?.message, { stack: error?.stack, context: 'AddToCompareButtonComponent.toggleCompare' });
      this.showToast('An error occurred. Please try again.', 'error');
    } finally {
      this.isLoading = false;
    }
  }

  getButtonTitle(): string {
    if (this.isLoading) {
      return 'Processing...';
    }

    if (this.isInCompare) {
      return 'Remove from Compare';
    }

    if (this.isCompareFull) {
      return `Maximum ${this.compareService['maxCompareItems'] || 4} items allowed`;
    }

    return 'Add to Compare';
  }

  private showToast(message: string, type: 'success' | 'error' | 'info' | 'warning') {
    // Implement your toast/notification system here
    // This is a placeholder - replace with your actual notification service

    // Example with simple browser notification:
    // You might want to use a more sophisticated notification system
    if (this.isBrowser && 'Notification' in window) {
      // Show browser notification for important actions
      if (type === 'success' && (message.includes('added') || message.includes('removed'))) {
        // Request permission if needed
        if (Notification.permission === 'granted') {
          new Notification('Compare List Updated', {
            body: message,
            icon: '/assets/icons/compare-icon.png', // Add your icon path
            badge: '/assets/icons/badge-icon.png'
          });
        }
      }
    }
  }

  private showComparePageSuggestion() {
    // Show a suggestion to view the compare page when user has 2+ items
    const suggestion = confirm('You now have multiple products to compare. Would you like to view the comparison page?');
    if (suggestion) {
      this.router.navigate(['/compare']);
    }
  }
}

// Example usage in a product card component:
/*
<!-- In your product-card.component.html -->
<div class="product-card">
  <div class="product-image">
    <img [src]="product.mediaUrl" [alt]="product.name">
  </div>

  <div class="product-info">
    <h3 class="product-title">{{ product.name }}</h3>
    <p class="product-price">${{ product.defaultPrice }}</p>
  </div>

  <div class="product-actions">
    <button class="btn btn-primary">Add to Cart</button>
    <button class="btn btn-outline-secondary">Add to Wishlist</button>

    <!-- Add the compare button -->
    <app-add-to-compare-button [product]="product"></app-add-to-compare-button>
  </div>
</div>
*/

// Don't forget to add the component to your module:
/*
// In your module file (e.g., shared.module.ts or app.module.ts)
import { AddToCompareButtonComponent } from './components/add-to-compare-button/add-to-compare-button.component';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

@NgModule({
  declarations: [
    AddToCompareButtonComponent,
    // ... other components
  ],
  exports: [
    AddToCompareButtonComponent,
    // ... other components
  ],
  // ... rest of module config

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
})
*/
