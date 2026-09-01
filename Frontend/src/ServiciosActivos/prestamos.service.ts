import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { environment } from './../ConfiguracionesActivas/AmbienteTrabajo/enviroments';
import { Prestamo, TrustScore, RespuestaApi } from './../ModelosActivos/ModelosAplicacion.model';

@Injectable({
  providedIn: 'root'
})
export class PrestamoService {
  
  // URL base hacia el módulo de préstamos en nuestro backend
  private readonly API_URL = `${environment.apiUrl}/prestamos`;

  constructor(private http: HttpClient) {}

  /**
   * ====================================================================
   * OPERACIONES CENTRALES DE PRÉSTAMO
   * ====================================================================
   */

  // Registra la salida física de un expediente
  solicitarPrestamo(payload: { numControl: string; solicitanteId: string; condicionEntrega: string }): Observable<RespuestaApi<Prestamo>> {
    return this.http.post<RespuestaApi<Prestamo>>(`${this.API_URL}/solicitar`, payload)
      .pipe(catchError(this.manejarError));
  }

  // Registra el retorno del documento al archivo
  registrarDevolucion(prestamoId: string, condicionDevolucion: string): Observable<RespuestaApi> {
    return this.http.put<RespuestaApi>(`${this.API_URL}/${prestamoId}/devolver`, { condicionDevolucion })
      .pipe(catchError(this.manejarError));
  }

  /**
   * ====================================================================
   * CONSULTAS Y MONITOREO
   * ====================================================================
   */

  // Obtiene todos los préstamos que no han sido devueltos (ideal para el Dashboard)
  consultarPrestamosActivos(): Observable<Prestamo[]> {
    return this.http.get<Prestamo[]>(`${this.API_URL}/activos`)
      .pipe(catchError(this.manejarError));
  }

  // Revisa el historial de préstamos de un expediente específico
  consultarHistorialExpediente(numControl: string): Observable<Prestamo[]> {
    return this.http.get<Prestamo[]>(`${this.API_URL}/expediente/${numControl}`)
      .pipe(catchError(this.manejarError));
  }

  /**
   * ====================================================================
   * FUNCIONES AVANZADAS: TRUST SCORE Y LISTA DE ESPERA
   * ====================================================================
   */

  // Consulta el nivel de confianza de un usuario antes de prestarle algo
  consultarTrustScore(solicitanteId: string): Observable<TrustScore> {
    return this.http.get<TrustScore>(`${this.API_URL}/trust-score/${solicitanteId}`)
      .pipe(catchError(this.manejarError));
  }

  // Inscribe a un usuario en la cola de espera si el expediente está ocupado
  anotarseListaEspera(numControl: string, solicitanteId: string): Observable<RespuestaApi> {
    return this.http.post<RespuestaApi>(`${this.API_URL}/waitlist`, { numControl, solicitanteId })
      .pipe(catchError(this.manejarError));
  }

  /**
   * ====================================================================
   * MANEJADOR CENTRALIZADO DE ERRORES (UX/UI)
   * ====================================================================
   */
  private manejarError(error: HttpErrorResponse) {
    let mensajeUsuario = 'Fallo al procesar la operación de préstamo.';

    if (error.error instanceof ErrorEvent) {
      mensajeUsuario = `Fallo de red: ${error.error.message}`;
    } else {
      // Atrapamos la estructura de la clase AppError del backend
      if (error.error && error.error.message) {
        mensajeUsuario = error.error.message;
      } else {
        switch (error.status) {
          case 400: mensajeUsuario = 'Datos incompletos para procesar el préstamo/devolución.'; break;
          case 403: mensajeUsuario = 'Bloqueo Zero-Trust: Operación fuera del horario permitido o Trust Score insuficiente.'; break;
          case 404: mensajeUsuario = 'El expediente o el solicitante no existen.'; break;
          case 409: mensajeUsuario = 'El expediente ya se encuentra prestado actualmente. Intenta unirte a la lista de espera.'; break;
          case 500: mensajeUsuario = 'Error en el servidor al registrar el movimiento.'; break;
        }
      }
    }

    return throwError(() => new Error(mensajeUsuario));
  }
}