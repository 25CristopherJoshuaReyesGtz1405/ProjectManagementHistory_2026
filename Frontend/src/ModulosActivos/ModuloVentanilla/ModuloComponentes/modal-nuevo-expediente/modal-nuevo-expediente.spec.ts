import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ModalNuevoExpediente } from './modal-nuevo-expediente';

describe('ModalNuevoExpediente', () => {
  let component: ModalNuevoExpediente;
  let fixture: ComponentFixture<ModalNuevoExpediente>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ModalNuevoExpediente],
    }).compileComponents();

    fixture = TestBed.createComponent(ModalNuevoExpediente);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
