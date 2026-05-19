import { ComponentFixture, TestBed } from '@angular/core/testing';

import { BannerStyle5Component } from './banner-style5.component';

describe('BannerStyle5Component', () => {
  let component: BannerStyle5Component;
  let fixture: ComponentFixture<BannerStyle5Component>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BannerStyle5Component]
    })
    .compileComponents();

    fixture = TestBed.createComponent(BannerStyle5Component);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
