import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TextSectionStyle1Component } from './text-section-style1.component';

describe('TextSectionStyle1Component', () => {
  let component: TextSectionStyle1Component;
  let fixture: ComponentFixture<TextSectionStyle1Component>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TextSectionStyle1Component]
    })
    .compileComponents();

    fixture = TestBed.createComponent(TextSectionStyle1Component);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
