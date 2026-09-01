import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TarjetaStadistic } from './tarjeta-stadistic';

describe('TarjetaStadistic', () => {
  let component: TarjetaStadistic;
  let fixture: ComponentFixture<TarjetaStadistic>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TarjetaStadistic]
    })
    .compileComponents();

    fixture = TestBed.createComponent(TarjetaStadistic);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
