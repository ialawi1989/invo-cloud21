import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CategoryCollectionStyle4Component } from './category-collection-style4.component';

describe('CategoryCollectionStyle4Component', () => {
  let component: CategoryCollectionStyle4Component;
  let fixture: ComponentFixture<CategoryCollectionStyle4Component>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CategoryCollectionStyle4Component]
    })
    .compileComponents();

    fixture = TestBed.createComponent(CategoryCollectionStyle4Component);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
