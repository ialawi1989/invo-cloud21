import { ComponentFixture, TestBed } from '@angular/core/testing';

import { NoConnectionStyle2Component } from './no-connection-style-2.component';

describe('NoConnectionStyle2Component', () => {
  let component: NoConnectionStyle2Component;
  let fixture: ComponentFixture<NoConnectionStyle2Component>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [NoConnectionStyle2Component]
    })
    .compileComponents();

    fixture = TestBed.createComponent(NoConnectionStyle2Component);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
