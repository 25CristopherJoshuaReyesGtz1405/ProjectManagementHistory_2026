// ModulosAvanzados/ExploradorPhygital/ExploradorPhygital.component.ts
import { Component, Input, OnDestroy, OnInit, ViewChild, ElementRef, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { Expediente } from '../../../ModelosActivos/ModelosAplicacion.model';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-explorador-phygital',
  templateUrl: './explorador-phygital.html',
  styleUrls: ['./explorador-phygital.scss'],
  imports: [CommonModule], 
  schemas: [CUSTOM_ELEMENTS_SCHEMA], 
  standalone: true
})
export class ExploradorPhygital implements OnInit, OnDestroy {
  
  // Inyectamos el expediente que el usuario está buscando
  @Input() expedienteObjetivo!: Expediente;
  
  // Referencia directa al DOM para manipulación segura sin romper Angular
  @ViewChild('escenaAR', { static: false }) escenaAR!: ElementRef;

  public idCajaAsignada: number = 0;
  public escaneoActivo: boolean = true;

  ngOnInit(): void {
    // PARACAÍDAS DE PRUEBA: Si no recibe datos del padre, crea un mock temporal
    if (!this.expedienteObjetivo) {
      console.warn('[SIGAH] Modo de prueba detectado: Usando expediente simulado.');
      this.expedienteObjetivo = {
        numControl: '22040000',
        ubicacion: { 
          estante: 'Caja 12', 
          estadoConservacion: 'BUENO' 
        }
      } as any; // Usamos 'as any' solo para saltar la validación estricta en la prueba
    }

    this.idCajaAsignada = this.extraerIdCaja(this.expedienteObjetivo.ubicacion.estante as string);

  }

  ngOnDestroy(): void {
    this.limpiarContextoWebGL();
  }

  private extraerIdCaja(ubicacionTexto: string): number {
    // Lógica para parsear tu string de ubicación a un ID matricial
    const match = ubicacionTexto.match(/\d+/);
    return match ? parseInt(match[0], 10) : 0;
  }

  public cerrarVisor(): void {
    this.escaneoActivo = false;
    this.limpiarContextoWebGL();
  }

  /**
   * Destrucción profesional de procesos en segundo plano.
   * Libera la cámara y el procesamiento de GPU (Graphics Processing Unit).
   */
  private limpiarContextoWebGL(): void {
    const videoElements = document.querySelectorAll('video');
    videoElements.forEach(video => {
      const stream = video.srcObject as MediaStream;
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
      video.remove();
    });

    // Eliminar variables globales inyectadas por AR.js para evitar colisiones
    if (window.hasOwnProperty('arToolkitSource')) {
      delete (window as any).arToolkitSource;
    }
  }
}