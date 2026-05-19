import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ServiceRequestBlankComponent } from './service-request-blank.component';

describe('ServiceRequestBlankComponent', () => {
  let component: ServiceRequestBlankComponent;
  let fixture: ComponentFixture<ServiceRequestBlankComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ServiceRequestBlankComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ServiceRequestBlankComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
