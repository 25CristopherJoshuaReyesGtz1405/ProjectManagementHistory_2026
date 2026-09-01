import { Component, EventEmitter, Output, ChangeDetectorRef, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

// Declaración de la API de Voz del navegador
declare var webkitSpeechRecognition: any;

@Component({
  selector: 'app-modal-nuevo-expediente',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './modal-nuevo-expediente.html',
  styleUrls: ['./modal-nuevo-expediente.scss']
})
export class ModalNuevoExpediente {
  
  @Output() close = new EventEmitter<void>();
  @Output() save = new EventEmitter<any>();

  // Inyección necesaria para actualizar la UI cuando la voz dicta los datos
  private cdr = inject(ChangeDetectorRef);

  // Modelo de Datos
  expediente = {
    matricula: '',
    nombre: '',
    apellidos: '',
    carrera: '',
    origenExterno: false,
    tecnologicoOrigen: '',
    motivoIngreso: ''
  };

  guardando: boolean = false;
  mostrarMotivoTraslado: boolean = false;

  // Variables para la Interfaz de Voz
  escuchandoVoz: boolean = false;
  private recognition: any;

  constructor() {
    this.inicializarReconocimientoVoz();
  }

  // === LÓGICA DE VOZ (HORIZONTE 3) ===
  private inicializarReconocimientoVoz(): void {
    if ('webkitSpeechRecognition' in window) {
      this.recognition = new webkitSpeechRecognition();
      this.recognition.continuous = false;
      this.recognition.interimResults = false;
      this.recognition.lang = 'es-MX'; // Español México

      this.recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript.toLowerCase();
        console.log('[Voice UI] Orden recibida:', transcript);
        this.procesarComandoVoz(transcript);
      };

      this.recognition.onerror = (event: any) => {
        console.error('[Voice UI] Error:', event.error);
        this.escuchandoVoz = false;
        this.cdr.detectChanges();
      };

      this.recognition.onend = () => {
        this.escuchandoVoz = false;
        this.cdr.detectChanges();
      };
    } else {
      console.warn('El reconocimiento de voz no está soportado en este navegador.');
    }
  }

  toggleDictado(): void {
    if (!this.recognition) return alert('Su navegador no es compatible con el dictado por voz.');
    
    if (this.escuchandoVoz) {
      this.recognition.stop();
    } else {
      this.recognition.start();
      this.escuchandoVoz = true;
    }
  }

  private procesarComandoVoz(frase: string): void {
    // 1. Extraer Matrícula
    const matchMatricula = frase.match(/matrícula\s+(\d+)/);
    if (matchMatricula) {
      this.expediente.matricula = matchMatricula[1];
      this.validarMatricula(); 
    }

    // 2. Extraer Nombre
    const matchNombre = frase.match(/nombre\s+([a-záéíóúñ\s]+?)(?=\s+apellidos|\s+carrera|$)/);
    if (matchNombre) {
      this.expediente.nombre = this.capitalizarTexto(matchNombre[1].trim());
    }

    // 3. Extraer Apellidos
    const matchApellidos = frase.match(/apellidos\s+([a-záéíóúñ\s]+?)(?=\s+carrera|$)/);
    if (matchApellidos) {
      this.expediente.apellidos = this.capitalizarTexto(matchApellidos[1].trim());
    }

    // 4. Mapeo de Carrera
    if (frase.includes('sistemas') || frase.includes('computacionales')) {
      this.expediente.carrera = 'Ingeniería en Sistemas Computacionales';
    } else if (frase.includes('industrial')) {
      this.expediente.carrera = 'Ingeniería Industrial';
    } else if (frase.includes('civil')) {
      this.expediente.carrera = 'Ingeniería Civil';
    } else if (frase.includes('arquitectura')) {
      this.expediente.carrera = 'Arquitectura';
    } else if (frase.includes('administración')) {
      this.expediente.carrera = 'Licenciatura en Administración';
    }

    // Forzar renderizado en pantalla
    this.cdr.detectChanges();
  }

  private capitalizarTexto(texto: string): string {
    return texto.replace(/\b\w/g, l => l.toUpperCase());
  }

  // === LÓGICA DEL FORMULARIO Y VALIDACIONES ===
  validarMatricula(): void {
    const mat = this.expediente.matricula.trim();
    
    if (mat.length >= 4) {
      const codigoTec = mat.substring(2, 4);
      // Si el código NO es '04' (ITD), mostramos los campos foráneos
      this.mostrarMotivoTraslado = (codigoTec !== '04');
      this.expediente.origenExterno = this.mostrarMotivoTraslado;
      
      if (!this.mostrarMotivoTraslado) {
        this.expediente.tecnologicoOrigen = '';
        this.expediente.motivoIngreso = '';
      }
    } else {
      this.mostrarMotivoTraslado = false;
    }
  }

  cerrarModal(): void {
    // Si la cámara/voz sigue escuchando, la apagamos al salir
    if (this.recognition && this.escuchandoVoz) {
      this.recognition.stop();
    }
    this.close.emit();
  }

  guardar(): void {
    if (this.guardando) return;
    this.guardando = true;
    
    setTimeout(() => {
      this.save.emit(this.expediente);
      this.guardando = false;
      this.cerrarModal();
    }, 1500); // Simulando red
  }
}