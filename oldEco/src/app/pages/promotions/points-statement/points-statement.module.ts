import { importProvidersFrom, NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { CarouselModule } from 'ngx-owl-carousel-o';
import { PointsStatementComponent } from './points-statement.component';

const routes: Routes = [{ path: '', component: PointsStatementComponent }];

@NgModule({
  declarations: [],
  imports: [
    CarouselModule,
    CommonModule,
    TranslateModule,
    PointsStatementComponent,
  ],
  providers: [importProvidersFrom(RouterModule.forChild(routes))],
  bootstrap: [],
})
export class PointsStatementComponentModule {}
