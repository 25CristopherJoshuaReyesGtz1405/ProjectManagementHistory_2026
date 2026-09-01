import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { environment } from './../ConfiguracionesActivas/AmbienteTrabajo/enviroments';
import { Expediente, RespuestaApi } from './../ModelosActivos/ModelosAplicacion.model';

@Injectable({
  providedIn: 'root'
})
export class ExpedienteService {
  
  // URL base apuntando a nuestro backend refactorizado
  private readonly API_URL = `${environment.apiUrl}/expedientes`;

  constructor(private http: HttpClient) {}

  /**
   * ====================================================================
   * MÉTODOS DE CONSULTA (GET)
   * ====================================================================
   */

  // Obtiene el acervo general
  obtenerExpedientes(): Observable<Expediente[]> {
    return this.http.get<Expediente[]>(`${this.API_URL}/`)
      .pipe(catchError(this.manejarError));
  }

  // Búsqueda reactiva por matrícula (Ideal para conectar con un input con debounce)
  buscarExpedientesGlobal(termino: string): Observable<Expediente[]> {
    return this.http.get<Expediente[]>(`${this.API_URL}/search?q=${termino}`)
      .pipe(catchError(this.manejarError));
  }

  // Detalle completo de una matrícula
  consultarPorNumControl(numControl: string): Observable<Expediente> {
    return this.http.get<Expediente>(`${this.API_URL}/${numControl}`)
      .pipe(catchError(this.manejarError));
  }

  /**
   * ====================================================================
   * MÉTODOS DE MUTACIÓN (POST, PUT)
   * ====================================================================
   */

  // Registra un nuevo expediente en el sistema
  crearExpediente(expediente: Expediente): Observable<RespuestaApi> {
    return this.http.post<RespuestaApi>(`${this.API_URL}/`, expediente)
      .pipe(catchError(this.manejarError));
  }

  // Actualiza con auditoría (Requiere motivo forzoso)
  actualizarExpediente(numControl: string, cambios: Partial<Expediente>, motivo: string): Observable<RespuestaApi> {
    const payload = { cambios, motivo };
    return this.http.put<RespuestaApi>(`${this.API_URL}/${numControl}`, payload)
      .pipe(catchError(this.manejarError));
  }

  /**
   * ====================================================================
   * KILLER FEATURES (Integración con IA y Background Jobs)
   * ====================================================================
   */

  // Sube el CSV al almacenamiento temporal del backend para procesarlo en background
  importarPadronMasivo(archivo: File): Observable<RespuestaApi> {
    const formData = new FormData();
    formData.append('archivo', archivo);

    return this.http.post<RespuestaApi>(`${this.API_URL}/upload-csv`, formData)
      .pipe(catchError(this.manejarError));
  }

  // Descongela un documento de la bóveda fría
  restaurarDesdeBovedaFria(numControl: string): Observable<RespuestaApi> {
    return this.http.post<RespuestaApi>(`${this.API_URL}/${numControl}/descongelar`, {})
      .pipe(catchError(this.manejarError));
  }

  // Envía el OCR al backend para análisis cognitivo
  analizarConIA(textoOCR: string): Observable<RespuestaApi> {
    return this.http.post<RespuestaApi>(`${this.API_URL}/triage-ia`, { textoOCR })
      .pipe(catchError(this.manejarError));
  }

  /**
   * ====================================================================
   * MANEJADOR CENTRALIZADO DE ERRORES (UX/UI)
   * ====================================================================
   * Transforma los errores HTTP del backend (AppError) en mensajes 
   * legibles para la interfaz de Angular.
   */
  private manejarError(error: HttpErrorResponse) {
    let mensajeUsuario = 'Ocurrió un error inesperado al conectar con el servidor.';

    if (error.error instanceof ErrorEvent) {
      // Error del lado del cliente (ej. red caída en la computadora)
      mensajeUsuario = `Error de red: ${error.error.message}`;
    } else {
      // Error devuelto por nuestro backend refactorizado (AppError nos manda un JSON estructurado)
      if (error.error && error.error.message) {
        mensajeUsuario = error.error.message;
      } else {
        // Fallback por si el error no viene con la estructura esperada
        switch (error.status) {
          case 400: mensajeUsuario = 'Los datos enviados son incorrectos.'; break;
          case 401: mensajeUsuario = 'Tu sesión ha expirado, vuelve a ingresar.'; break;
          case 403: mensajeUsuario = 'No tienes permisos para realizar esta acción (o es fuera de horario).'; break;
          case 404: mensajeUsuario = 'El registro solicitado no fue encontrado en el acervo.'; break;
          case 500: mensajeUsuario = 'Fallo interno en el sistema. Contacta a soporte técnico.'; break;
        }
      }
    }

    // Retornamos un observable con el mensaje limpio para que el componente lo muestre en un Toast/Snackbar
    return throwError(() => new Error(mensajeUsuario));
  }
}