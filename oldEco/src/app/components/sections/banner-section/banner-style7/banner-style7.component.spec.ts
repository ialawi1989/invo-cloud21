import { ComponentFixture, TestBed } from '@angular/core/testing';

import { BannerStyle7Component } from './banner-style7.component';

describe('BannerStyle7Component', () => {
  let component: BannerStyle7Component;
  let fixture: ComponentFixture<BannerStyle7Component>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BannerStyle7Component]
    })
    .compileComponents();

    fixture = TestBed.createComponent(BannerStyle7Component);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
