import { ComponentFixture, TestBed } from '@angular/core/testing';

import { BannerStyle6Component } from './banner-style6.component';

describe('BannerStyle6Component', () => {
  let component: BannerStyle6Component;
  let fixture: ComponentFixture<BannerStyle6Component>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BannerStyle6Component]
    })
    .compileComponents();

    fixture = TestBed.createComponent(BannerStyle6Component);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
