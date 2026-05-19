import { Component, OnDestroy} from '@angular/core';
import { Collection } from '../../models/collection.model';
import { RouterLink } from '@angular/router';
import { ThemeService } from '../../services/themeServices/theme.service';
import { BranchStatusAlertComponent } from "../../components/branch-status-alert/branch-status-alert.component";
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

@Component({
  selector: 'app-collections',
  imports: [RouterLink, BranchStatusAlertComponent],
  templateUrl: './collections.component.html',
  styleUrl: './collections.component.css',
})
export class CollectionsComponent implements OnDestroy {
  private destroy$ = new Subject<void>();
  collections: Collection[] = [];

   constructor(
      private themeService: ThemeService,
    ) {
    }

    ngOnInit() {
      this.loadInitialData()
    }

    loadInitialData(): void {
      this.themeService.getHomeCollections().pipe(takeUntil(this.destroy$)).subscribe({
        next: (data: Collection[]) => {
          this.collections = data || [];
        },
        error: e => this.handleError(e),
      });
    }

    handleError(e: any) {
    }

    

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
