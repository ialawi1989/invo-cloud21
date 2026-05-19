import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TextSectionStyle2Component } from './text-section-style2.component';

describe('TextSectionStyle2Component', () => {
  let component: TextSectionStyle2Component;
  let fixture: ComponentFixture<TextSectionStyle2Component>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TextSectionStyle2Component]
    })
    .compileComponents();

    fixture = TestBed.createComponent(TextSectionStyle2Component);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
