import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ServiceRequestPopComponent } from './service-request-pop.component';

describe('ServiceRequestPopComponent', () => {
  let component: ServiceRequestPopComponent;
  let fixture: ComponentFixture<ServiceRequestPopComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ServiceRequestPopComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ServiceRequestPopComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
