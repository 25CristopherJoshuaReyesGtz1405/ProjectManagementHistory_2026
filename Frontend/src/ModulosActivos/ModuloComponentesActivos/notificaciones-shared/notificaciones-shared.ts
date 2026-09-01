import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NotificacionesService, ModalConfirmacion } from './../../../ServiciosActivos/notificaciones.service';
import { Observable } from 'rxjs';

@Component({
  selector: 'app-notificaciones-shared',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './notificaciones-shared.html',
  styleUrl: './notificaciones-shared.scss',
})
export class NotificacionesShared {
  
  servicio = inject(NotificacionesService);
  
  // 1. Signals para los Toasts (alertas flotantes)
  lista = this.servicio.notificaciones; 
  
  // 2. Observable para el Modal de Confirmación
  // Este es el que te faltaba o no estaba bien conectado.
  // Escucha los cambios en el servicio para saber si hay un modal activo.
  modalState$: Observable<ModalConfirmacion | null> = this.servicio.modalState$;

  constructor() {}

  // --- LÓGICA DEL MODAL ---

  /**
   * Se ejecuta cuando el usuario da click en el botón principal (Confirmar)
   */
  onConfirm(modal: ModalConfirmacion) {
    // Ejecuta la acción que se pasó al crear el modal (ej. eliminar estudiante)
    if (modal.accion) {
      modal.accion(); 
    }
    // Cierra el modal
    this.servicio.cerrarConfirmacion();
  }

  loadingState$ = this.servicio.loadingState$;

  /**
   * Se ejecuta cuando el usuario da click en Cancelar o en el fondo oscuro
   */
  onCancel() {
    this.servicio.cerrarConfirmacion();
  }
  
}