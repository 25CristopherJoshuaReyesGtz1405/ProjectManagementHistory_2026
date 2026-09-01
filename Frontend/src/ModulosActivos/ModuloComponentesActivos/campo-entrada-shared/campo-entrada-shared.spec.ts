import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CampoEntradaShared } from './campo-entrada-shared';

describe('CampoEntradaShared', () => {
  let component: CampoEntradaShared;
  let fixture: ComponentFixture<CampoEntradaShared>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CampoEntradaShared]
    })
    .compileComponents();

    fixture = TestBed.createComponent(CampoEntradaShared);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
