import { Component, EventEmitter, inject, OnInit, OnDestroy, Output } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, Subscription, of } from 'rxjs';
import {
  debounceTime,
  distinctUntilChanged,
  switchMap,
  catchError,
  tap,
  map,
} from 'rxjs/operators';

// Importaciones de tus servicios y modelos
import { ExpedienteService } from './../../../../ServiciosActivos/expediente.service';
import { PersonaService } from './../../../../ServiciosActivos/personas.service';
import { Expediente, Persona } from './../../../../ModelosActivos/ModelosAplicacion.model';
import { NotificacionesService } from '../../../../ServiciosActivos/notificaciones.service';
import { ModalPrestarFisico } from '../modal-prestar-fisico/modal-prestar-fisico';

@Component({
  selector: 'app-modal-busqueda-expediente',
  imports: [CommonModule, FormsModule, ModalPrestarFisico],
  templateUrl: './modal-busqueda-expediente.html',
  styleUrls: ['./modal-busqueda-expediente.scss'],
  providers: [DatePipe],
  standalone: true,
})
export class ModalBusquedaExpediente implements OnInit, OnDestroy {
  @Output() close = new EventEmitter<void>();

  private expedientesService = inject(ExpedienteService);
  private personasService = inject(PersonaService);
  private notificaciones = inject(NotificacionesService); // <--- AÑADIR AQUÍ

  // ESTADOS DEL MODAL
  vistaActual: 'buscar' | 'visor' = 'buscar';

  // VARIABLES DE BÚSQUEDA
  terminoBusqueda: string = '';
  buscando: boolean = false;
  resultadosExpedientes: Expediente[] = [];
  resultadosPersonas: Persona[] = [];

  // VARIABLES DEL VISOR
  expedienteSeleccionado: Expediente | any;
  nombreTitularSeleccionado: string = '';

  cargandoVisor: boolean = false;

  private buscadorSubject = new Subject<string>();
  private subscripcion!: Subscription;

  alEscribir(): void {
    // RASTREADOR 1: ¿Angular detecta que escribes?
    console.log('[Angular] 1. Tecla detectada. Valor:', this.terminoBusqueda);

    this.buscadorSubject.next(this.terminoBusqueda);
    if (!this.terminoBusqueda.trim()) this.limpiarResultados();
  }

  ngOnInit(): void {
    // RASTREADOR 2: ¿El RxJS está vivo?
    console.log('[Angular] 0. Buscador inicializado y escuchando...');

    this.subscripcion = this.buscadorSubject
      .pipe(
        debounceTime(350),
        distinctUntilChanged(),
        tap((termino) => {
          // RASTREADOR 3: ¿Pasó el filtro de tiempo?
          console.log('[Angular] 2. Filtro RxJS superado. Buscando:', termino);
          this.buscando = true;
          this.limpiarResultados();
        }),
        switchMap((termino) => {
          const term = termino.trim();
          if (!term) return of({ tipo: 'vacio', data: [] });

          // ¿Son puros números?
          const esMatricula = /^\d+$/.test(term);

          if (esMatricula) {
            // =======================================================
            // MODO FRANCOTIRADOR: Usamos tu ruta exacta por numControl
            // =======================================================
            return this.expedientesService.consultarPorNumControl(term).pipe(
              // Si lo encuentra, lo metemos en un arreglo para que el HTML lo dibuje
              map((res) => ({ tipo: 'expediente', data: res ? [res] : [] })),
              // Si el backend lanza un 404 (aún no terminan de escribir), devolvemos vacío sin romper la app
              catchError((err) => {
                console.log('[Angular] Matrícula aún no encontrada o incompleta...');
                return of({ tipo: 'expediente', data: [] });
              }),
            );
          } else {
            // =======================================================
            // MODO RADAR: Usamos la búsqueda de nombres en Personas
            // =======================================================
            return this.personasService.buscarPorNombre(term).pipe(
              map((res) => ({ tipo: 'persona', data: res })),
              catchError((err) => {
                console.error('[Angular] Error al buscar persona:', err);
                return of({ tipo: 'error', data: [] });
              }),
            );
          }
        }),
      )
      .subscribe((resultado: any) => {
        // RASTREADOR 5: ¿Volvió la respuesta?
        console.log('[Angular] 4. Respuesta final recibida:', resultado);
        this.buscando = false;
        if (resultado.tipo === 'expediente') this.resultadosExpedientes = resultado.data;
        else if (resultado.tipo === 'persona') this.resultadosPersonas = resultado.data;
      });
  }

  ngOnDestroy(): void {
    if (this.subscripcion) this.subscripcion.unsubscribe();
  }

  limpiarResultados(): void {
    this.resultadosExpedientes = [];
    this.resultadosPersonas = [];
  }

  volverABuscar(): void {
    this.vistaActual = 'buscar';
    this.expedienteSeleccionado = null;
  }

  cerrarModal(): void {
    this.close.emit();
  }

  imprimirCaratula(): void {
    console.log('Imprimiendo carátula para:', this.expedienteSeleccionado?.numControl);
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

  // =========================================================
  // CASO A: CLICK EN UN EXPEDIENTE (Buscó por matrícula)
  // =========================================================

  seleccionarExpediente(exp: Expediente): void {
    this.expedienteSeleccionado = exp;
    this.vistaActual = 'visor';
    this.nombreTitularSeleccionado = 'Cargando titular...'; // Texto temporal elegante

    this.notificaciones.mostrarLoading(
      'Autenticando Identidad',
      `Cruzando la matrícula ${exp.numControl} con el padrón maestro del ITD...`,
    );

    // Hacemos una petición rápida para traer el nombre real usando el personaId
    this.personasService.buscarPorNombre(exp.personaId).subscribe({
      next: (personas) => {
        const persona = Array.isArray(personas) ? personas[0] : personas;
        if (persona) {
          this.nombreTitularSeleccionado =
            `${persona.nombre} ${persona.primerApellido} ${persona.segundoApellido || ''}`.trim();
        } else {
          this.nombreTitularSeleccionado = 'Titular No Identificado';
        }
        this.notificaciones.ocultarLoading();
      },
      error: () => {
        this.nombreTitularSeleccionado = 'Titular No Identificado';
        this.notificaciones.ocultarLoading();
      },
    });
  }

  // =========================================================
  // CASO B: CLICK EN UNA PERSONA (Buscó por nombre)
  // =========================================================
  seleccionarPersona(persona: Persona): void {

    this.notificaciones.mostrarLoading(
      'Verificando Expediente',
      `Buscando si ${persona.nombre} ${persona.primerApellido} tiene un expediente digitalizado...`,
    );
    // 1. Verificamos si la persona tiene un expediente físico asociado
    if (!persona.expedientesAsociados || persona.expedientesAsociados.length === 0) {
      this.notificaciones.mostrar(
        'info',
        'Sin Expediente Físico',
        'Esta identidad aún no cuenta con un expediente digitalizado en el acervo.',
      );
      this.notificaciones.ocultarLoading();
      return;
    }

    // 2. Si tiene expediente, tomamos su matrícula
    const matriculaAsociada = persona.expedientesAsociados[0];
    this.nombreTitularSeleccionado =
      `${persona.nombre} ${persona.primerApellido} ${persona.segundoApellido || ''}`.trim();

    // Mostramos un loader o activamos el estado de búsqueda
    this.buscando = true;

    // 3. Traemos el expediente completo usando la ruta infalible que ya arreglamos
    this.expedientesService.consultarPorNumControl(matriculaAsociada).subscribe({
      next: (exp) => {
        this.expedienteSeleccionado = exp;
        this.vistaActual = 'visor';
        this.buscando = false;
        this.notificaciones.ocultarLoading();
      },
      error: () => {
        this.buscando = false;
        this.notificaciones.mostrar(
          'error',
          'Error Forense',
          'No se pudo recuperar el documento de la bóveda digital.',
        );
      },
    });
  }
}
