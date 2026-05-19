import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ServiceRequestCompoComponent } from './service-request-compo.component';

describe('ServiceRequestCompoComponent', () => {
  let component: ServiceRequestCompoComponent;
  let fixture: ComponentFixture<ServiceRequestCompoComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ServiceRequestCompoComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ServiceRequestCompoComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
