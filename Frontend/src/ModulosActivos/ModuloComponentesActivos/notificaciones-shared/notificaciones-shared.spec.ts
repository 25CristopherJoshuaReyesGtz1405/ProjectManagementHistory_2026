import { ComponentFixture, TestBed } from '@angular/core/testing';

import { NotificacionesShared } from './notificaciones-shared';

describe('NotificacionesShared', () => {
  let component: NotificacionesShared;
  let fixture: ComponentFixture<NotificacionesShared>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [NotificacionesShared]
    })
    .compileComponents();

    fixture = TestBed.createComponent(NotificacionesShared);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
