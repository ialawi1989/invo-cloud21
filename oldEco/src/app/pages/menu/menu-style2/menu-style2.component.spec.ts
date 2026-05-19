import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MenuStyle2Component } from './menu-style2.component';

describe('MenuStyle2Component', () => {
  let component: MenuStyle2Component;
  let fixture: ComponentFixture<MenuStyle2Component>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MenuStyle2Component]
    })
    .compileComponents();

    fixture = TestBed.createComponent(MenuStyle2Component);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
