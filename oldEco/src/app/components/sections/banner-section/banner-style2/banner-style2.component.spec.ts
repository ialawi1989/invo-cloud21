import { ComponentFixture, TestBed } from '@angular/core/testing';

import { BannerStyle2Component } from './banner-style2.component';

describe('BannerStyle2Component', () => {
  let component: BannerStyle2Component;
  let fixture: ComponentFixture<BannerStyle2Component>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BannerStyle2Component]
    })
    .compileComponents();

    fixture = TestBed.createComponent(BannerStyle2Component);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
