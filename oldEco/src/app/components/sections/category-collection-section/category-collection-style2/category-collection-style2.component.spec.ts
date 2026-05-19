import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CategoryCollectionStyle2Component } from './category-collection-style2.component';

describe('CategoryCollectionStyle2Component', () => {
  let component: CategoryCollectionStyle2Component;
  let fixture: ComponentFixture<CategoryCollectionStyle2Component>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CategoryCollectionStyle2Component]
    })
    .compileComponents();

    fixture = TestBed.createComponent(CategoryCollectionStyle2Component);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
