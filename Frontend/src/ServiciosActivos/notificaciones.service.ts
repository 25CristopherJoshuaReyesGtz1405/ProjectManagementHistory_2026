import { Injectable, signal } from '@angular/core';
import { BehaviorSubject, Observable, Subject } from 'rxjs'; // ¡Importante importar esto!

// --- Interfaces ---

export interface Toast {
  id: number;
  tipo: 'exito' | 'error' | 'info';
  titulo: string;
  mensaje: string;
  cerrando?: boolean;
}

// ¡Esta es la interfaz que faltaba exportar!
export interface ModalConfirmacion {
  titulo: string;
  mensaje: string;
  textoBotonConfirmar: string;
  accion: () => void; // La función a ejecutar al confirmar
}

export interface LoadingState {
  titulo: string;
  mensaje: string;
}

@Injectable({ providedIn: 'root' })
export class NotificacionesService {
  
  // ==========================================
  // 1. LÓGICA DE TOASTS (Ya la tenías)
  // ==========================================
  notificaciones = signal<Toast[]>([]);
  private contador = 0;

  mostrar(tipo: 'exito' | 'error' | 'info', titulo: string, mensaje: string) {
    const id = this.contador++;
    const nuevoToast: Toast = { id, tipo, titulo, mensaje };
    
    this.notificaciones.update(actuales => [...actuales, nuevoToast]);

    setTimeout(() => this.cerrar(id), 5000);
  }

  cerrar(id: number) {
    this.notificaciones.update(actuales => 
      actuales.map(t => t.id === id ? { ...t, cerrando: true } : t)
    );

    setTimeout(() => {
      this.notificaciones.update(actuales => actuales.filter(t => t.id !== id));
    }, 400); 
  }

  // ==========================================
  // 2. LÓGICA DE MODAL (¡ESTO FALTABA!)
  // ==========================================

  // Subject privado para emitir eventos del modal
  private modalSubject = new Subject<ModalConfirmacion | null>();
  
  // Observable público (modalState$) que escucha el componente
  public modalState$ = this.modalSubject.asObservable();

  /**
   * Abre el modal de confirmación.
   * @param titulo Título del modal
   * @param mensaje Mensaje del cuerpo
   * @param accion Función que se ejecutará si el usuario acepta
   * @param textoBotonConfirmar Texto del botón (ej: 'Sí, eliminar')
   */
  confirmar(
    titulo: string,
    mensaje: string,
    accion: () => void,
    textoBotonConfirmar: string = 'Confirmar'
  ) {
    this.modalSubject.next({ titulo, mensaje, accion, textoBotonConfirmar });
  }

  /**
   * Cierra el modal (se llama al cancelar o al confirmar)
   */
  cerrarConfirmacion() {
    this.modalSubject.next(null);
  }

  private loadingSubject = new BehaviorSubject<LoadingState | null>(null);
public loadingState$ = this.loadingSubject.asObservable();

// Método para invocar el láser
mostrarLoading(titulo: string, mensaje: string): void {
  this.loadingSubject.next({ titulo, mensaje });
}

// Método para apagar el láser cuando termine el proceso
ocultarLoading(): void {
  this.loadingSubject.next(null);
}
}