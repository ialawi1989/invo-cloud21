import { Component, OnInit, OnDestroy} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

@Component({
  selector: 'app-error',
  imports: [
    TranslateModule
  ],
  templateUrl: './error.component.html',
  styleUrl: './error.component.css'
})
export class ErrorComponent implements OnInit , OnDestroy{
  private destroy$ = new Subject<void>();

  errorMsg = "";

  constructor(
    private router: Router,
    private route: ActivatedRoute
  ) {
  }

  ngOnInit(){
    this.route.queryParams.pipe(takeUntil(this.destroy$)).subscribe(params => {
      this.errorMsg = params['msg'];
    });
  }

  gotoHomePage() {
    this.router.navigate(['/'], { queryParams: {} });
  }


  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
