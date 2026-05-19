import { ComponentFixture, TestBed } from '@angular/core/testing';

import { RichTextSectionComponent } from './rich-text-section.component';

describe('RichTextSectionComponent', () => {
  let component: RichTextSectionComponent;
  let fixture: ComponentFixture<RichTextSectionComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RichTextSectionComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(RichTextSectionComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
