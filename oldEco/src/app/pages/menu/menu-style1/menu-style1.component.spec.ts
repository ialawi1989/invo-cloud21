import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MenuStyle1Component } from './menu-style1.component';

describe('MenuStyle1Component', () => {
  let component: MenuStyle1Component;
  let fixture: ComponentFixture<MenuStyle1Component>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MenuStyle1Component]
    })
    .compileComponents();

    fixture = TestBed.createComponent(MenuStyle1Component);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
