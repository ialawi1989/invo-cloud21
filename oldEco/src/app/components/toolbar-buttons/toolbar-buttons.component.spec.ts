import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ToolBarButtonsComponent } from './toolbar-buttons.component';

describe('ToolBarButtonsComponent', () => {
  let component: ToolBarButtonsComponent;
  let fixture: ComponentFixture<ToolBarButtonsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ToolBarButtonsComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ToolBarButtonsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
