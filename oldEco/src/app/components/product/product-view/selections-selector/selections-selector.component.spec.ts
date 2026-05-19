import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SelectionsSelectorComponent } from './selections-selector.component';

describe('SelectionsSelectorComponent', () => {
  let component: SelectionsSelectorComponent;
  let fixture: ComponentFixture<SelectionsSelectorComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SelectionsSelectorComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(SelectionsSelectorComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
