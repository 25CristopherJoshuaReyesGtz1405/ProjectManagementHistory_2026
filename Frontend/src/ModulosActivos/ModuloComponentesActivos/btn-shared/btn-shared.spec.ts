import { ComponentFixture, TestBed } from '@angular/core/testing';

import { BtnShared } from './btn-shared';

describe('BtnShared', () => {
  let component: BtnShared;
  let fixture: ComponentFixture<BtnShared>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BtnShared]
    })
    .compileComponents();

    fixture = TestBed.createComponent(BtnShared);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
