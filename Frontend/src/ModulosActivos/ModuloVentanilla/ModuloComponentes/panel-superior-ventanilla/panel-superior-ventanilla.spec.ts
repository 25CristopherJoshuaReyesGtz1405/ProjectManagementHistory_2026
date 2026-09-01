import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PanelSuperiorVentanilla } from './panel-superior-ventanilla';

describe('PanelSuperiorVentanilla', () => {
  let component: PanelSuperiorVentanilla;
  let fixture: ComponentFixture<PanelSuperiorVentanilla>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PanelSuperiorVentanilla],
    }).compileComponents();

    fixture = TestBed.createComponent(PanelSuperiorVentanilla);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
