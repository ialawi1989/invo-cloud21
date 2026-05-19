import { ComponentFixture, TestBed } from '@angular/core/testing';

import { RedeemPromoComponent } from './redeem-promo.component';

describe('RedeemPromoComponent', () => {
  let component: RedeemPromoComponent;
  let fixture: ComponentFixture<RedeemPromoComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RedeemPromoComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(RedeemPromoComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
