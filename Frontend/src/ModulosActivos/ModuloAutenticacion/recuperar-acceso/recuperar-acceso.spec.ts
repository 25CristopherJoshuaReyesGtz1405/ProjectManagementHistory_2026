import { ComponentFixture, TestBed } from '@angular/core/testing';

import { RecuperarAcceso } from './recuperar-acceso';

describe('RecuperarAcceso', () => {
  let component: RecuperarAcceso;
  let fixture: ComponentFixture<RecuperarAcceso>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RecuperarAcceso],
    }).compileComponents();

    fixture = TestBed.createComponent(RecuperarAcceso);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
