import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PanelLateralVentanilla } from './panel-lateral-ventanilla';

describe('PanelLateralVentanilla', () => {
  let component: PanelLateralVentanilla;
  let fixture: ComponentFixture<PanelLateralVentanilla>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PanelLateralVentanilla],
    }).compileComponents();

    fixture = TestBed.createComponent(PanelLateralVentanilla);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
