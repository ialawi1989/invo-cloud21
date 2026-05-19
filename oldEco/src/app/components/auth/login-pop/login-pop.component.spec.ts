import { ComponentFixture, TestBed } from '@angular/core/testing';

import { LoginPopComponent } from './login-pop.component';

describe('LoginPopComponent', () => {
  let component: LoginPopComponent;
  let fixture: ComponentFixture<LoginPopComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LoginPopComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(LoginPopComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
