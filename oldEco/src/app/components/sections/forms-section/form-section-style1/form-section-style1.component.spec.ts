import { ComponentFixture, TestBed } from '@angular/core/testing';

import { FormSectionStyle1Component } from './form-section-style1.component';

describe('FormSectionStyle1Component', () => {
  let component: FormSectionStyle1Component;
  let fixture: ComponentFixture<FormSectionStyle1Component>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FormSectionStyle1Component]
    })
    .compileComponents();

    fixture = TestBed.createComponent(FormSectionStyle1Component);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
