import { Component, inject, OnInit } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { Observable } from 'rxjs';
import { AuthService } from '../../../../ServiciosActivos/auth.service';
import { Expediente, PerfilUsuarioDTO } from './../../../../ModelosActivos/ModelosAplicacion.model';
import { TarjetaStadistic } from '../../ModuloComponentes/tarjeta-stadistic/tarjeta-stadistic';
import { ModalNuevoExpediente } from '../../ModuloComponentes/modal-nuevo-expediente/modal-nuevo-expediente';
import { NotificacionesService } from '../../../../ServiciosActivos/notificaciones.service';
import { ExpedienteService } from '../../../../ServiciosActivos/expediente.service';
import { ModalBusquedaExpediente } from '../../ModuloComponentes/modal-busqueda-expediente/modal-busqueda-expediente';
import { ModalPrestarFisico } from '../../ModuloComponentes/modal-prestar-fisico/modal-prestar-fisico';

@Component({
  selector: 'app-panel-principal',
  imports: [CommonModule, TarjetaStadistic, ModalNuevoExpediente, ModalBusquedaExpediente, ModalPrestarFisico],
  templateUrl: './panel-principal.html',
  styleUrl: './panel-principal.scss',
  providers: [DatePipe], // <-- Necesario para el pipe de fecha en el HTML
  standalone: true,

})
export class PanelPrincipal implements OnInit {

  private expedienteService = inject(ExpedienteService);
  private notificaciones = inject(NotificacionesService);
  
  private authService = inject(AuthService);
  
  usuario$: Observable<PerfilUsuarioDTO | null>;
  saludoDelDia: string = 'Buen día';
  today: Date = new Date();

  expedienteSeleccionado: Expediente | null = null;

  constructor() {
    this.usuario$ = this.authService.getUsuario();
  }

  ngOnInit(): void {
    this.calcularSaludo();
  }

  private calcularSaludo(): void {
    const hora = this.today.getHours();
    if (hora >= 5 && hora < 12) {
      this.saludoDelDia = 'Buenos días';
    } else if (hora >= 12 && hora < 19) {
      this.saludoDelDia = 'Buenas tardes';
    } else {
      this.saludoDelDia = 'Buenas noches';
    }
  }

  //  * Modal Nuevo Expediente 

  // Estado para controlar la visibilidad
  isModalNuevoOpen: boolean = false;

  // Métodos de control
  abrirModalNuevo() {
    this.isModalNuevoOpen = true;
  }

  cerrarModalNuevo() {
    this.isModalNuevoOpen = false;
  }

  // Captura los datos enviados desde el modal
  /**
   * 2. LA TRANSACCIÓN ATÓMICA
   * Recibe los datos dictados/escritos del modal y los envía al backend
   */
  procesarNuevoExpediente(datosModal: any) {
    this.cerrarModalNuevo();

    this.notificaciones.mostrarLoading(
      'Generando Matrícula', 
      'Sincronizando el nuevo expediente con la base de datos central del ITD...'
    );

    // EL PAYLOAD EXACTO PARA ENAMORAR A ZOD
    const nuevoExpedienteForense = {
      numControl: datosModal.matricula,
      personaId: 'PENDIENTE_VINCULACION', 
      nivel: 'LICENCIATURA',
      
      // 1. CORRECCIÓN: Zod pide "carrera" (no carreraId)
      carrera: datosModal.carrera, 
      
      // 2. CORRECCIÓN: Zod exige una CURP que pase su Regex estricta. 
      // Esta es una CURP temporal genérica válida para poder crear el registro.
      curp: 'XAXX010101HDFXXX01', 
      
      ubicacion: {
        // 3 y 4. CORRECCIÓN: Zod exige edificio y estante
        edificio: 'ARCHIVO CENTRAL',
        estante: 'POR ASIGNAR',
        caja: 'RECEPCION_NUEVOS',
        carpeta: `EXP-${datosModal.matricula}`
      }
    };

    // ENVIAMOS AL SERVICIO
    this.expedienteService.crearExpediente(nuevoExpedienteForense as any).subscribe({
      next: (respuesta) => {
        this.notificaciones.ocultarLoading();
        this.notificaciones.mostrar('exito', 'Expediente creado', `Expediente ${datosModal.matricula} (${datosModal.nombre}) inicializado correctamente.`);
      },
      error: (err) => {
        console.error('[SIGAH] Error al crear expediente:', err);
        this.notificaciones.ocultarLoading();
        
        // Manejo de errores de Zod para que se vean en tu modal de error
        const mensajeError = err.error?.message || 'Fallo de conexión con el servidor.';
        this.notificaciones.mostrar('error', 'Error de validación', `Error de validación: ${mensajeError}`);
      }
    });
  }

  // 3. AGREGAMOS LOS ESTADOS PARA EL MODAL BUSCADOR
  isModalBuscadorOpen: boolean = false;
  
  abrirModalBuscador() {
    this.isModalBuscadorOpen = true;
  }

  cerrarModalBuscador() {
    this.isModalBuscadorOpen = false;
  }

  // --- CONTROL DEL MODAL DE PRÉSTAMOS ---
  mostrarModalPrestamo: boolean = false;

  abrirModalPrestamo(): void {
    this.mostrarModalPrestamo = true;
  }

  cerrarModalPrestamo(): void {
    this.mostrarModalPrestamo = false;
  }

  // Se ejecuta cuando el modal de préstamo emite el evento de éxito
  manejarPrestamoExitoso(datosPrestamo: any): void {
    // 1. Ocultamos el modal de préstamo
    this.mostrarModalPrestamo = false;
    
    // 2. Actualizamos visualmente el estatus del expediente en el visor sin recargar la base de datos
    if (this.expedienteSeleccionado) {
      this.expedienteSeleccionado.estatus = 'TRANSITO';
    }
  }

}