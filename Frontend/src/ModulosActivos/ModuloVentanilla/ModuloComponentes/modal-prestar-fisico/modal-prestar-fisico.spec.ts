import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ModalPrestarFisico } from './modal-prestar-fisico';

describe('ModalPrestarFisico', () => {
  let component: ModalPrestarFisico;
  let fixture: ComponentFixture<ModalPrestarFisico>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ModalPrestarFisico],
    }).compileComponents();

    fixture = TestBed.createComponent(ModalPrestarFisico);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
