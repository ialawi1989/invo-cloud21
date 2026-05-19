import { Component, ChangeDetectorRef, OnInit, OnDestroy } from '@angular/core';
import { LoadingService } from '../../services/loadingService/loading.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-loading',
  templateUrl: './loading.component.html',
  styleUrls: ['./loading.component.css'],
  standalone: false
})
export class LoadingComponent implements OnInit, OnDestroy {

  loading: boolean = false; // Initialize loading state
  private loadingSubscription!: Subscription;

  constructor(private loadingService: LoadingService, private cdr: ChangeDetectorRef) { }

  ngOnInit() {
    // Subscribe to loading state changes
    this.loadingSubscription = this.loadingService.loadingChange$.subscribe(isLoading => {
      this.loading = isLoading;
      this.cdr.detectChanges(); // Update the view
    });
  }

  ngOnDestroy() {
    // Clean up subscription
    if (this.loadingSubscription) {
      this.loadingSubscription.unsubscribe();
    }
  }
  
}
