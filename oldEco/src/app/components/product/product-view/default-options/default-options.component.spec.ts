import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DefaultOptionsComponent } from './default-options.component';

describe('DefaultOptionsComponent', () => {
  let component: DefaultOptionsComponent;
  let fixture: ComponentFixture<DefaultOptionsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DefaultOptionsComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(DefaultOptionsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
