import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CategoryCollectionStyle1Component } from './category-collection-style1.component';

describe('CategoryCollectionStyle1Component', () => {
  let component: CategoryCollectionStyle1Component;
  let fixture: ComponentFixture<CategoryCollectionStyle1Component>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CategoryCollectionStyle1Component]
    })
    .compileComponents();

    fixture = TestBed.createComponent(CategoryCollectionStyle1Component);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
