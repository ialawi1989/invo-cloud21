import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ButtonsSectionStyle1Component } from './buttons-section-style1.component';

describe('ButtonsSectionStyle1Component', () => {
  let component: ButtonsSectionStyle1Component;
  let fixture: ComponentFixture<ButtonsSectionStyle1Component>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ButtonsSectionStyle1Component]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ButtonsSectionStyle1Component);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
