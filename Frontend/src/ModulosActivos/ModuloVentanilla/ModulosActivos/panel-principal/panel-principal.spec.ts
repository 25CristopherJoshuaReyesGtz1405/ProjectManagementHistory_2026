import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PanelPrincipal } from './panel-principal';

describe('PanelPrincipal', () => {
  let component: PanelPrincipal;
  let fixture: ComponentFixture<PanelPrincipal>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PanelPrincipal]
    })
    .compileComponents();

    fixture = TestBed.createComponent(PanelPrincipal);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
