import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { environment } from '../ConfiguracionesActivas/AmbienteTrabajo/enviroments';
import { EstadisticasDashboard, RespuestaApi, ReporteGenerado } from '../ModelosActivos/ModelosAplicacion.model';

@Injectable({
  providedIn: 'root'
})
export class EstadisticaService {
  
  // URL base hacia el módulo de estadísticas
  private readonly API_URL = `${environment.apiUrl}/estadisticas`;

  constructor(private http: HttpClient) {}

  /**
   * ====================================================================
   * DASHBOARD Y VISTAS MATERIALIZADAS
   * ====================================================================
   */

  /**
   * Obtiene la vista materializada pre-calculada por el Cron Job nocturno.
   * Carga ultrarrápida, ideal para la pantalla principal (Home/Dashboard).
   */
  obtenerDashboardGeneral(): Observable<EstadisticasDashboard> {
    return this.http.get<EstadisticasDashboard>(`${this.API_URL}/dashboard`)
      .pipe(catchError(this.manejarError));
  }

  /**
   * ====================================================================
   * REPORTES BAJO DEMANDA (Operaciones pesadas)
   * ====================================================================
   */

  /**
   * Solicita al servidor que genere un reporte en Excel/PDF en tiempo real.
   * Esto consume más recursos, por lo que se recomienda usar con precaución.
   * 
   * @param fechaInicio - Fecha de inicio del periodo a evaluar
   * @param fechaFin - Fecha de fin del periodo a evaluar
   */
  generarReporteHistorico(fechaInicio: string, fechaFin: string): Observable<RespuestaApi<ReporteGenerado>> {
    const payload = { fechaInicio, fechaFin };
    return this.http.post<RespuestaApi<ReporteGenerado>>(`${this.API_URL}/reportes/generar`, payload)
      .pipe(catchError(this.manejarError));
  }

  /**
   * Fuerza el recálculo de las estadísticas en el servidor.
   * (Operación restringida por Zero-Trust, idealmente solo para Super Admins)
   */
  forzarRecalculoManual(): Observable<RespuestaApi> {
    return this.http.post<RespuestaApi>(`${this.API_URL}/dashboard/recalcular`, {})
      .pipe(catchError(this.manejarError));
  }

  /**
   * ====================================================================
   * MANEJADOR CENTRALIZADO DE ERRORES (UX/UI)
   * ====================================================================
   */
  private manejarError(error: HttpErrorResponse) {
    let mensajeUsuario = 'Ocurrió un error al cargar las estadísticas del sistema.';

    if (error.error instanceof ErrorEvent) {
      mensajeUsuario = `Fallo de conexión: ${error.error.message}`;
    } else {
      if (error.error && error.error.message) {
        mensajeUsuario = error.error.message;
      } else {
        switch (error.status) {
          case 400: mensajeUsuario = 'Las fechas proporcionadas para el reporte no son válidas.'; break;
          case 403: mensajeUsuario = 'No tienes permisos de Administrador para solicitar reportes o forzar cálculos.'; break;
          case 404: mensajeUsuario = 'Aún no existen estadísticas pre-calculadas para mostrar.'; break;
          case 429: mensajeUsuario = 'Se han solicitado demasiados reportes en poco tiempo. Intenta más tarde.'; break;
          case 500: mensajeUsuario = 'Error en el motor de análisis de datos.'; break;
        }
      }
    }

    return throwError(() => new Error(mensajeUsuario));
  }
}