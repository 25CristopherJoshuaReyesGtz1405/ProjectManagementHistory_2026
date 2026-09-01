import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PanelLayout } from './panel-layout';

describe('PanelLayout', () => {
  let component: PanelLayout;
  let fixture: ComponentFixture<PanelLayout>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PanelLayout],
    }).compileComponents();

    fixture = TestBed.createComponent(PanelLayout);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
