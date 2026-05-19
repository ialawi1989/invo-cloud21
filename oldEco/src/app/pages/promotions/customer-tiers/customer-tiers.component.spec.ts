import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CustomerTiersComponent } from './customer-tiers.component';

describe('CustomerTiersComponent', () => {
  let component: CustomerTiersComponent;
  let fixture: ComponentFixture<CustomerTiersComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CustomerTiersComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(CustomerTiersComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
