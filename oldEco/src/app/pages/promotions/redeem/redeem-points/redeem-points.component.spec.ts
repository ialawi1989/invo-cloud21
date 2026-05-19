import { ComponentFixture, TestBed } from '@angular/core/testing';

import { RedeemPointsComponent } from './redeem-points.component';

describe('RedeemPointsComponent', () => {
  let component: RedeemPointsComponent;
  let fixture: ComponentFixture<RedeemPointsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RedeemPointsComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(RedeemPointsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
