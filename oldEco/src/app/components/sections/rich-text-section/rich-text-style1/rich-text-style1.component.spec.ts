import { ComponentFixture, TestBed } from '@angular/core/testing';

import { RichTextStyle1Component } from './rich-text-style1.component';

describe('RichTextStyle1Component', () => {
  let component: RichTextStyle1Component;
  let fixture: ComponentFixture<RichTextStyle1Component>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RichTextStyle1Component]
    })
    .compileComponents();

    fixture = TestBed.createComponent(RichTextStyle1Component);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
