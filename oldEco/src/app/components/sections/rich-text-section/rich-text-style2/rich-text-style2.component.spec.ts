import { ComponentFixture, TestBed } from '@angular/core/testing';

import { RichTextStyle2Component } from './rich-text-style2.component';

describe('RichTextStyle2Component', () => {
  let component: RichTextStyle2Component;
  let fixture: ComponentFixture<RichTextStyle2Component>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RichTextStyle2Component]
    })
    .compileComponents();

    fixture = TestBed.createComponent(RichTextStyle2Component);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
