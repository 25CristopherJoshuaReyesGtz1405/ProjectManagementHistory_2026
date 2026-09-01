import { Component, ElementRef, inject, ViewChild } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms'; // Necesario para el [(ngModel)]
import * as Tesseract from 'tesseract.js';
import { NotificacionesService } from '../../../../ServiciosActivos/notificaciones.service';
import { TarjetaStadistic } from '../../ModuloComponentes/tarjeta-stadistic/tarjeta-stadistic';
import { ArchivoAdjunto, Expediente } from '../../../../ModelosActivos/ModelosAplicacion.model';
import { ExpedienteService } from '../../../../ServiciosActivos/expediente.service';

@Component({
  selector: 'app-digitalizador-ocr',
  standalone: true,
  imports: [CommonModule, FormsModule, TarjetaStadistic],
  templateUrl: './digitalizador-ocr.html',
  styleUrls: ['./digitalizador-ocr.scss'], 
    providers: [DatePipe] // <-- Necesario para el pipe de fecha en el HTML

})
export class DigitalizadorOcr {
  
  // Nuevas variables de Telemetría Forense
  precisionOcr: number = 0;
  conteoPalabras: number = 0;
  tiempoProcesamiento: string = '0.0s';

  today: Date = new Date();

  @ViewChild('fileInput') fileInput!: ElementRef;
  @ViewChild('videoElement') videoElement!: ElementRef<HTMLVideoElement>;
  
  // 2. Estados de la Cámara
  modoCamara: boolean = false;
  private streamCamara: MediaStream | null = null
  
  arrastrando: boolean = false;
  procesando: boolean = false;
  progresoOcr: number = 0;
  imagenPreview: string | null = null;
  textoExtraido: string = '';

  private notificaciones = inject(NotificacionesService);
  private expedientesService = inject(ExpedienteService);

  /**
   * Transforma el texto crudo del OCR en el Payload exacto que espera Zod en el backend.
   */
  private estructurarPayloadZod(textoCrudo: string): Expediente {
    const textoLimpio = textoCrudo.replace(/\n+/g, ' ').trim();

    // 1. Extracción del Número de Control (Patrón de 8 dígitos clásico)
    const regexNumControl = /\b\d{8}\b/;
    const matchNumControl = textoLimpio.match(regexNumControl);
    const numControlExtraido = matchNumControl ? matchNumControl[0] : 'POR_ASIGNAR';

    // 2. Extracción de Folio Digital (Buscamos DUR-XX-XX o similar)
    const regexFolio = /(?:Folio|Proyecto|Registro)[\s:]*([A-Z0-9-]+)/i;
    const matchFolio = textoLimpio.match(regexFolio);
    const folioExtraido = matchFolio ? matchFolio[1].trim() : `FD-${new Date().getTime()}`;

    // 3. Determinación de Titulación (Buscamos palabras clave)
    const tieneTitulo = /Otorga el presente|Título de/i.test(textoLimpio);

    // 4. Ensamblaje del Payload (Cumpliendo estrictamente tu interfaz)
    return {
      numControl: numControlExtraido,
      personaId: 'PENDIENTE_VINCULACION', // Se actualizará en el proceso de revisión humana
      folioDigital: folioExtraido,

      // Datos Académicos por defecto (a confirmar por el operador)
      nivel: 'LICENCIATURA', // Asumiendo un enum NivelAcademico
      carreraId: 'POR_ASIGNAR',
      generacion: 'NO_DETECTADA',
      estatus: 'ACTIVO', // Asumiendo un enum EstatusExpediente

      // Ubicación Física Base
      ubicacion: {
        caja: 'RECEPCION_DIGITAL',
        carpeta: 'TRAMITE',
        estadoConservacion: 'BUENO' // Asumiendo enum EstadoConservacion
      },

      // Propiedades requeridas por la interfaz Expediente
      bloqueadoHistorico: false,
      metadata: {
        creadoPor: 'DIGITALIZADOR_OCR',
        fechaCreacion: new Date(),
        ultimaActualizacion: new Date()
      } as unknown as Expediente['metadata'],

      // Módulo de Titulación dinámico según la lectura
      titulacion: {
        tieneActaNacimiento: false,
        tieneCertificadoPreparatoria: false,
        tieneCertificadoLicenciatura: false,
        tieneTitulo: tieneTitulo,
        tieneCedula: false,
        inglesB1: false,
        actividadesComplementarias: false,
        servicioSocial: false,
        residenciaProfesional: false
      },

      // Archivo digitalizado incrustado como respaldo
      archivos: [
        {
          id: crypto.randomUUID(),
          nombre: `Escaneo_Forense_${numControlExtraido}.txt`,
          url: 'base64_o_url_pendiente',
          fechaSubida: new Date(),
          tipo: 'OTRO',
          subidoPor: ''
        } as unknown as ArchivoAdjunto
      ]
    };
  }


  // === PROTECCIÓN DE MEMORIA ===
  ngOnDestroy(): void {
    this.apagarCamara(); // Apaga el hardware si el usuario cambia de página
  }

  // === LÓGICA DE LA CÁMARA (WEBRTC) ===
  async activarCamara(): Promise<void> {
    try {
      // Solicitamos acceso a la cámara trasera (ideal para tablets/móviles) o la principal en PC
      this.streamCamara = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'environment' } 
      });
      
      this.modoCamara = true;
      
      // Damos tiempo a Angular para renderizar la etiqueta <video> antes de inyectar el stream
      setTimeout(() => {
        if (this.videoElement && this.videoElement.nativeElement) {
          this.videoElement.nativeElement.srcObject = this.streamCamara;
          this.videoElement.nativeElement.play();
        }
      }, 100);

    } catch (error) {
      console.error('Error al acceder a la cámara:', error);
      this.notificaciones.mostrar('error', 'Acceso No Concedido a Cámara', 'No se pudo acceder a la cámara. Verifique los permisos.');
      this.modoCamara = false;
    }
  }

  apagarCamara(): void {
    if (this.streamCamara) {
      this.streamCamara.getTracks().forEach(track => track.stop());
      this.streamCamara = null;
    }
    this.modoCamara = false;
  }

  async capturarFotografia(): Promise<void> {
    if (!this.videoElement || !this.videoElement.nativeElement) return;

    const video = this.videoElement.nativeElement;
    
    // Creamos un canvas temporal en memoria con la resolución exacta del video
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    
    const context = canvas.getContext('2d');
    if (!context) return;
    
    // Dibujamos el fotograma actual del video en el canvas
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    
    // Extraemos la imagen como base64 (DataURL)
    const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
    
    // Apagamos el hardware de la cámara para ahorrar batería
    this.apagarCamara();
    
    // Mostramos la vista previa en la interfaz
    this.imagenPreview = dataUrl;
    
    // Convertimos el DataURL a un objeto File para que Tesseract lo procese igual que una subida normal
    const res = await fetch(dataUrl);
    const blob = await res.blob();
    const file = new File([blob], `captura_forense_${new Date().getTime()}.jpg`, { type: 'image/jpeg' });

    // Lanzamos tu método existente de OCR
    this.iniciarReconocimientoOptico(file);
  }

  // === EVENTOS DRAG & DROP ===
  onDragOver(event: DragEvent): void {
    event.preventDefault();
    this.arrastrando = true;
  }

  onDragLeave(event: DragEvent): void {
    event.preventDefault();
    this.arrastrando = false;
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    this.arrastrando = false;
    const files = event.dataTransfer?.files;
    if (files && files.length > 0) {
      this.procesarArchivo(files[0]);
    }
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      this.procesarArchivo(input.files[0]);
    }
  }

  // === LÓGICA CORE: TESSERACT.JS ===
  private procesarArchivo(file: File): void {
    if (!file.type.startsWith('image/')) {
      alert('Por favor, selecciona un archivo de imagen válido.');
      return;
    }

    // 1. Mostrar vista previa
    const reader = new FileReader();
    reader.onload = (e) => {
      this.imagenPreview = e.target?.result as string;
      this.iniciarReconocimientoOptico(file);
    };
    reader.readAsDataURL(file);
  }

  private async iniciarReconocimientoOptico(file: File): Promise<void> {
    this.procesando = true;
    this.textoExtraido = '';
    this.progresoOcr = 0;
    
    // Capturamos el tiempo de inicio
    const tiempoInicio = performance.now();

    this.notificaciones.mostrarLoading('Procesando Archivo', 'El motor óptico está digitalizando el documento.');

    try {
      const worker = await Tesseract.createWorker('spa', 1, {
        logger: m => {
          if (m.status === 'recognizing text') this.progresoOcr = m.progress;
        }
      });
      
      const result = await worker.recognize(file);
      this.textoExtraido = result.data.text;
      
      // EXTRACCIÓN DE TELEMETRÍA FORENSE
      this.precisionOcr = result.data.confidence; // Porcentaje de certeza de la IA
      this.conteoPalabras = this.textoExtraido.trim().split(/\s+/).length;
      
      // Cálculo del tiempo transcurrido
      const tiempoFin = performance.now();
      this.tiempoProcesamiento = ((tiempoFin - tiempoInicio) / 1000).toFixed(1) + 's';

      await worker.terminate();
      this.notificaciones.ocultarLoading();
      this.notificaciones.mostrar('exito', 'Digitalización completada.', 'El texto ha sido extraído correctamente.');

    } catch (error) {
      this.notificaciones.ocultarLoading();
      this.notificaciones.mostrar('error', 'Fallo en la lectura forense.', 'No se pudo procesar el documento.');
    } finally {
      this.procesando = false;
    }
  }

  // Nuevo método para la barra táctica
  descargarTxt(): void {
    if (!this.textoExtraido) return;
    const blob = new Blob([this.textoExtraido], { type: 'text/plain' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `SIGAH_Transcripcion_${new Date().getTime()}.txt`;
    a.click();
    window.URL.revokeObjectURL(url);
    this.notificaciones.mostrar('info', 'Archivo TXT descargado.', 'El archivo ha sido descargado correctamente.');
  }

  private async iniciarReconocimientoOptico1(file: File): Promise<void> {
  this.procesando = true;
  this.textoExtraido = '';
  this.progresoOcr = 0;

  const tiempoInicio = performance.now();

  // 1. Levantamos el escudo protector y el láser
  this.notificaciones.mostrarLoading(
    'Procesando Archivo', 
    'El motor óptico está digitalizando el documento. Por favor, espere.'
  );

  try {
    const worker = await Tesseract.createWorker('spa', 1);
    const result = await worker.recognize(file);
    this.textoExtraido = result.data.text;
    await worker.terminate();

    // 2. Apagamos el láser
    this.notificaciones.ocultarLoading();
    // 3. Mostramos la confirmación de éxito
    this.notificaciones.mostrar('exito', 'Digitalización completada.', 'El texto ha sido extraído correctamente.');

  } catch (error) {
    this.notificaciones.ocultarLoading();
    this.notificaciones.mostrar('error', 'Error en la lectura forense.', 'No se pudo procesar el documento.');
  } finally {
    this.procesando = false;
  }
}

  // === ACCIONES DE LA INTERFAZ ===
  reiniciarEscaneo(): void {
    this.apagarCamara(); // Añadimos esto por seguridad
    this.imagenPreview = null;
    this.textoExtraido = '';
    this.progresoOcr = 0;
    if (this.fileInput) { 
      this.fileInput.nativeElement.value = '';
    }
    this.notificaciones.mostrar('info', 'Motor óptico reiniciado.', 'El motor ha sido reiniciado correctamente.');
  }

  copiarTexto(): void {
    if (this.textoExtraido) {
      navigator.clipboard.writeText(this.textoExtraido);
      this.notificaciones.mostrar('exito', 'Texto copiado.', 'El texto ha sido copiado al portapapeles.');
    }
  }

  guardarExpediente(): void {
    if (!this.textoExtraido) {
      this.notificaciones.mostrar('error', 'Error', 'No hay transcripción disponible para enviar.');
      return;
    }

    // Modal de carga con diseño premium
    this.notificaciones.mostrarLoading(
      'Generando Sello Criptográfico', 
      'Sincronizando el documento digitalizado con el clúster central...'
    );

    const payload = this.estructurarPayloadZod(this.textoExtraido);

    // Suscripción al Observable de Angular para realizar el POST
    this.expedientesService.crearExpediente(payload).subscribe({
      next: (respuesta) => {
        // La transacción batch() de Firestore fue exitosa
        this.notificaciones.ocultarLoading();
        this.notificaciones.mostrar('exito', 'Expediente Archivado', 'El documento ha sido archivado exitosamente.');
        
        // Limpiamos la zona para el siguiente escaneo
        this.reiniciarEscaneo();
      },
      error: (err) => {
        console.error('[SIGAH Backend Error]:', err);
        this.notificaciones.ocultarLoading();
        // Leemos el mensaje de Zod o Express si existe
        const mensajeError = err.error?.message || 'Fallo de conexión con el servidor.';
        this.notificaciones.mostrar('error', 'Error de validación', `Error de validación - ${mensajeError}`);
      }
    });
  }
}