import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ButtonsSectionStyle2Component } from './buttons-section-style2.component';

describe('ButtonsSectionStyle2Component', () => {
  let component: ButtonsSectionStyle2Component;
  let fixture: ComponentFixture<ButtonsSectionStyle2Component>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ButtonsSectionStyle2Component]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ButtonsSectionStyle2Component);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
