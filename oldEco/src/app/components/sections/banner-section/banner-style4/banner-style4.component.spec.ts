import { ComponentFixture, TestBed } from '@angular/core/testing';

import { BannerStyle4Component } from './banner-style4.component';

describe('BannerStyle4Component', () => {
  let component: BannerStyle4Component;
  let fixture: ComponentFixture<BannerStyle4Component>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BannerStyle4Component]
    })
    .compileComponents();

    fixture = TestBed.createComponent(BannerStyle4Component);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
