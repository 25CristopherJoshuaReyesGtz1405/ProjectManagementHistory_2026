import { Component, EventEmitter, Input, Output, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Subject, of } from 'rxjs';
import { debounceTime, distinctUntilChanged, switchMap, catchError, tap } from 'rxjs/operators';

import { Expediente, PerfilUsuarioDTO } from './../../../../ModelosActivos/ModelosAplicacion.model';
import { NotificacionesService } from '../../../../ServiciosActivos/notificaciones.service';
import { PrestamoService } from '../../../../ServiciosActivos/prestamos.service';
import { AuthService } from '../../../../ServiciosActivos/auth.service';
import { ExpedienteService } from '../../../../ServiciosActivos/expediente.service'; 

@Component({
  selector: 'app-modal-prestar-fisico',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './modal-prestar-fisico.html',
  styleUrls: ['./modal-prestar-fisico.scss']
})
export class ModalPrestarFisico implements OnInit {
  
  // Si llega lleno, es modo Contextual. Si llega vacío, es modo Global (Búsqueda).
  @Input() expedienteSeleccionado: Expediente | null = null;
  @Output() close = new EventEmitter<void>();
  @Output() prestamoExitoso = new EventEmitter<any>();

  private fb = inject(FormBuilder);
  private notificaciones = inject(NotificacionesService);
  private prestamosService = inject(PrestamoService);
  private authService = inject(AuthService);
  private expedientesService = inject(ExpedienteService);

  prestamoForm!: FormGroup;
  procesando: boolean = false;
  operadorActual: PerfilUsuarioDTO | null = null;
  
  // Variables para el buscador de Expedientes (Modo Global)
  buscadorExpedientes$ = new Subject<string>();
  resultadosExpedientes: Expediente[] = [];
  buscandoExpediente: boolean = false;

  ngOnInit(): void {
    // 1. Extraemos el UID directo del token de sesión para la auditoría
    this.operadorActual = this.authService.getUsuarioSnapshot();

    // 2. Formulario ultra simplificado: solo necesitamos la justificación
    this.prestamoForm = this.fb.group({
      observaciones: ['', [Validators.required, Validators.minLength(10)]]
    });

    // 3. Motor Reactivo para buscar el expediente (Solo se usa si no pasaron uno por @Input)
    this.buscadorExpedientes$.pipe(
      debounceTime(350),
      distinctUntilChanged(),
      tap(() => this.buscandoExpediente = true),
      switchMap(termino => {
        const term = termino.trim();
        if (!term) {
          this.resultadosExpedientes = [];
          return of([]);
        }
        // Buscamos matrículas usando tu servicio existente
        return this.expedientesService.consultarPorNumControl(term).pipe(
          switchMap(res => of(res ? [res] : [])),
          catchError(() => of([]))
        );
      })
    ).subscribe(resultados => {
      this.resultadosExpedientes = resultados;
      this.buscandoExpediente = false;
    });
  }

  alEscribirMatricula(event: any): void {
    this.buscadorExpedientes$.next(event.target.value);
  }

  seleccionarExpediente(exp: Expediente): void {
    if (exp.estatus === 'TRANSITO') {
      this.notificaciones.mostrar('error', 'No Disponible', 'Esta carpeta ya se encuentra fuera del archivo.');
      return;
    }
    this.expedienteSeleccionado = exp;
    this.resultadosExpedientes = []; 
  }

  cambiarExpediente(): void {
    // Permite volver al buscador si se equivocaron de carpeta
    this.expedienteSeleccionado = null;
    this.prestamoForm.reset();
  }

  cerrarModal(): void {
    this.close.emit();
  }

  autorizarSalida(): void {
    if (this.prestamoForm.invalid) {
      this.prestamoForm.markAllAsTouched();
      this.notificaciones.mostrar('error', 'Protocolo Incompleto', 'Debe justificar el motivo de la extracción.');
      return;
    }

    if (!this.expedienteSeleccionado || !this.operadorActual) return;

    this.procesando = true;
    const observaciones = this.prestamoForm.value.observaciones;
    const solicitanteId = this.operadorActual.usuarioActual.uid; // Tomado del token maestro

    this.notificaciones.mostrarLoading('Autorizando Salida', 'Registrando en auditoría forense...');

    /*this.prestamosService.solicitarPrestamo({ numControl: this.expedienteSeleccionado.numControl, solicitanteId, observaciones }).subscribe({
      next: (respuesta: any) => {
        this.notificaciones.ocultarLoading();
        this.notificaciones.mostrar('exito', 'Custodia Transferida', `Folio: ${respuesta.folio}`);
        
        // Generamos el Vale Digital en PDF

        this.prestamoExitoso.emit(respuesta); 
        this.cerrarModal();
      },
      error: (err) => {
        this.notificaciones.ocultarLoading();
        this.procesando = false;
        this.notificaciones.mostrar('error', 'Operación Denegada', err.error?.message || 'Fallo de conexión');
      }
    });*/
  }

  
}