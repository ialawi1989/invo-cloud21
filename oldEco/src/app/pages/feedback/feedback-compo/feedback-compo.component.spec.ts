import { ComponentFixture, TestBed } from '@angular/core/testing';

import { FeedbackCompoComponent } from './feedback-compo.component';

describe('FeedbackCompoComponent', () => {
  let component: FeedbackCompoComponent;
  let fixture: ComponentFixture<FeedbackCompoComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FeedbackCompoComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(FeedbackCompoComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
