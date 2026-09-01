import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ModalBusquedaExpediente } from './modal-busqueda-expediente';

describe('ModalBusquedaExpediente', () => {
  let component: ModalBusquedaExpediente;
  let fixture: ComponentFixture<ModalBusquedaExpediente>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ModalBusquedaExpediente],
    }).compileComponents();

    fixture = TestBed.createComponent(ModalBusquedaExpediente);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
