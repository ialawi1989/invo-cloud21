import { ComponentFixture, TestBed } from '@angular/core/testing';

import { BannerStyle3Component } from './banner-style3.component';

describe('BannerStyle3Component', () => {
  let component: BannerStyle3Component;
  let fixture: ComponentFixture<BannerStyle3Component>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BannerStyle3Component]
    })
    .compileComponents();

    fixture = TestBed.createComponent(BannerStyle3Component);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
