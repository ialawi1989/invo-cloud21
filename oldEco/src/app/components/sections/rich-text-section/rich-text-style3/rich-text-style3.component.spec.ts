import { ComponentFixture, TestBed } from '@angular/core/testing';

import { RichTextStyle3Component } from './rich-text-style3.component';

describe('RichTextStyle3Component', () => {
  let component: RichTextStyle3Component;
  let fixture: ComponentFixture<RichTextStyle3Component>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RichTextStyle3Component]
    })
    .compileComponents();

    fixture = TestBed.createComponent(RichTextStyle3Component);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
