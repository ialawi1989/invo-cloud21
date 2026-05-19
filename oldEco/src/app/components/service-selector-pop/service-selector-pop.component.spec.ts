import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ServiceSelectorPopComponent } from './service-selector-pop.component';

describe('ServiceSelectorPopComponent', () => {
  let component: ServiceSelectorPopComponent;
  let fixture: ComponentFixture<ServiceSelectorPopComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ServiceSelectorPopComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ServiceSelectorPopComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
