import { ComponentFixture, TestBed } from '@angular/core/testing';

import { BannerStyle8Component } from './banner-style8.component';

describe('BannerStyle8Component', () => {
  let component: BannerStyle8Component;
  let fixture: ComponentFixture<BannerStyle8Component>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BannerStyle8Component]
    })
    .compileComponents();

    fixture = TestBed.createComponent(BannerStyle8Component);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
