import { ComponentFixture, TestBed } from '@angular/core/testing';

import { OptionGroupsSelectorComponent } from './option-groups-selector.component';

describe('OptionGroupsSelectorComponent', () => {
  let component: OptionGroupsSelectorComponent;
  let fixture: ComponentFixture<OptionGroupsSelectorComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [OptionGroupsSelectorComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(OptionGroupsSelectorComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
