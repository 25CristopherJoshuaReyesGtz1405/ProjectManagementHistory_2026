import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { environment } from './../ConfiguracionesActivas/AmbienteTrabajo/enviroments';
import { Persona, RespuestaApi } from './../ModelosActivos/ModelosAplicacion.model';

@Injectable({
  providedIn: 'root'
})
export class PersonaService {
  
  // URL base apuntando a nuestro backend refactorizado
  private readonly API_URL = `${environment.apiUrl}/personas`;

  constructor(private http: HttpClient) {}

  /**
   * ====================================================================
   * MÉTODOS DE CONSULTA (GET)
   * ====================================================================
   */

  // Búsqueda reactiva fonética (Ideal para conectar con un RxJS Subject + debounceTime)
  buscarPorNombre(termino: string): Observable<Persona[]> {
    return this.http.get<Persona[]>(`${this.API_URL}/search?q=${termino}`)
      .pipe(catchError(this.manejarError));
  }

  // Búsqueda exacta de la Identidad Maestra a partir de una matrícula
  buscarPorNumControl(numControl: string): Observable<Persona> {
    return this.http.get<Persona>(`${this.API_URL}/matricula/${numControl}`)
      .pipe(catchError(this.manejarError));
  }

  // Obtiene el detalle completo de una identidad maestra mediante su ID de documento
  consultarPorId(idDocumento: string): Observable<Persona> {
    return this.http.get<Persona>(`${this.API_URL}/id/${idDocumento}`)
      .pipe(catchError(this.manejarError));
  }

  /**
   * ====================================================================
   * MÉTODOS DE MUTACIÓN (POST, PUT)
   * ====================================================================
   */

  // Registra o recupera una identidad basándose en la CURP (Patrón Upsert)
  asegurarIdentidad(datosPersona: Partial<Persona>): Observable<RespuestaApi> {
    return this.http.post<RespuestaApi>(`${this.API_URL}/asegurar`, datosPersona)
      .pipe(catchError(this.manejarError));
  }

  // Vincula un número de control (matrícula) a la identidad maestra existente
  vincularMatricula(personaId: string, numControl: string): Observable<RespuestaApi> {
    const payload = { numControl };
    return this.http.put<RespuestaApi>(`${this.API_URL}/${personaId}/vincular`, payload)
      .pipe(catchError(this.manejarError));
  }

  /**
   * ====================================================================
   * MANEJADOR CENTRALIZADO DE ERRORES (UX/UI)
   * ====================================================================
   */
  private manejarError(error: HttpErrorResponse) {
    let mensajeUsuario = 'Ocurrió un error inesperado al conectar con el servidor.';

    if (error.error instanceof ErrorEvent) {
      // Fallo del lado del cliente (ej. sin conexión a internet)
      mensajeUsuario = `Fallo de conexión: ${error.error.message}`;
    } else {
      // Errores validados devueltos por la clase AppError desde Express
      if (error.error && error.error.message) {
        mensajeUsuario = error.error.message;
      } else {
        switch (error.status) {
          case 400: mensajeUsuario = 'Verifica los datos ingresados. La CURP o la matrícula podrían ser inválidas.'; break;
          case 401: mensajeUsuario = 'Tu sesión ha expirado.'; break;
          case 404: mensajeUsuario = 'La identidad solicitada no se encuentra registrada en el padrón.'; break;
          case 409: mensajeUsuario = 'Conflicto: Esta matrícula ya se encuentra vinculada a otra identidad.'; break;
          case 500: mensajeUsuario = 'Error en el motor de identidades. Contacta a soporte técnico.'; break;
        }
      }
    }

    return throwError(() => new Error(mensajeUsuario));
  }
}