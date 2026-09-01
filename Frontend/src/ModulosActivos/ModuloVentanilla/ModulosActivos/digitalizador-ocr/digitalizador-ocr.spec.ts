import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DigitalizadorOCR } from './digitalizador-ocr';

describe('DigitalizadorOCR', () => {
  let component: DigitalizadorOCR;
  let fixture: ComponentFixture<DigitalizadorOCR>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DigitalizadorOCR],
    }).compileComponents();

    fixture = TestBed.createComponent(DigitalizadorOCR);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
