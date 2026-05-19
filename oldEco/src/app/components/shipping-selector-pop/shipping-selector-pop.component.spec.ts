import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ShippingSelectorPopComponent } from './shipping-selector-pop.component';

describe('ShippingSelectorPopComponent', () => {
  let component: ShippingSelectorPopComponent;
  let fixture: ComponentFixture<ShippingSelectorPopComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ShippingSelectorPopComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ShippingSelectorPopComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
