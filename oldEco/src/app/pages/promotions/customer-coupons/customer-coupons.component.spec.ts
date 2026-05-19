import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CustomerCouponsComponent } from './customer-coupons.component';

describe('CustomerCouponsComponent', () => {
  let component: CustomerCouponsComponent;
  let fixture: ComponentFixture<CustomerCouponsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CustomerCouponsComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(CustomerCouponsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
