import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CustomerTierDetailsComponent } from './customer-tier-details.component';

describe('CustomerTierDetailsComponent', () => {
  let component: CustomerTierDetailsComponent;
  let fixture: ComponentFixture<CustomerTierDetailsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CustomerTierDetailsComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(CustomerTierDetailsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
