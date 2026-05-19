import { ComponentFixture, TestBed } from '@angular/core/testing';

import { BannerStyle1Component } from './banner-style1.component';

describe('BannerStyle1Component', () => {
  let component: BannerStyle1Component;
  let fixture: ComponentFixture<BannerStyle1Component>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BannerStyle1Component]
    })
    .compileComponents();

    fixture = TestBed.createComponent(BannerStyle1Component);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
