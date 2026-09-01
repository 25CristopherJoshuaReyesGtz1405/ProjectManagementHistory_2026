import { Component, CUSTOM_ELEMENTS_SCHEMA, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { NotificacionesShared } from '../ModulosActivos/ModuloComponentesActivos/notificaciones-shared/notificaciones-shared';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, NotificacionesShared],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App {
  protected readonly title = signal('Frontend');
}
