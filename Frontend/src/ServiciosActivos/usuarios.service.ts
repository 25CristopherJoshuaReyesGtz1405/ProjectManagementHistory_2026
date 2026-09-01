import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError, BehaviorSubject } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import { environment } from './../ConfiguracionesActivas/AmbienteTrabajo/enviroments';
import { Usuario, RespuestaAuth, RespuestaApi } from './../ModelosActivos/ModelosAplicacion.model';

@Injectable({
  providedIn: 'root'
})
export class UsuarioService {
  

  
  private API_URL = `${environment.apiUrl}/usuarios`;
  
  // BehaviorSubject para que los componentes (como el Navbar) reaccionen si el usuario inicia o cierra sesión
  private usuarioActualSubject = new BehaviorSubject<Usuario | null>(null);
  public usuarioActual$ = this.usuarioActualSubject.asObservable();

  constructor(private http: HttpClient) {
    this.cargarUsuarioDesdeStorage();
  }

  /**
   * ====================================================================
   * AUTENTICACIÓN Y ACCESO (Zero-Trust)
   * ====================================================================
   */

  // Inicia sesión y almacena el token
  iniciarSesion(correo: string, otpHash: string): Observable<RespuestaAuth> {
    return this.http.post<RespuestaAuth>(`${this.API_URL}/login`, { correo, otpHash })
      .pipe(
        tap(respuesta => this.establecerSesion(respuesta)),
        catchError(this.manejarError)
      );
  }

  // Cierra sesión y limpia el almacenamiento
  cerrarSesion(): void {
    localStorage.removeItem('token_sigah');
    localStorage.removeItem('usuario_sigah');
    this.usuarioActualSubject.next(null);
    // Aquí idealmente rediriges al login con el Router
  }

  /**
   * ====================================================================
   * GESTIÓN DE CUENTAS
   * ====================================================================
   */

  // Obtiene la lista de usuarios (Ideal para el panel de Administrador)
  obtenerUsuarios(): Observable<Usuario[]> {
    return this.http.get<Usuario[]>(`${this.API_URL}/`)
      .pipe(catchError(this.manejarError));
  }

  // Suspende o reactiva manualmente a un usuario
  cambiarEstatusUsuario(usuarioId: string, nuevoEstatus: 'ACTIVO' | 'SUSPENDIDO'): Observable<RespuestaApi> {
    return this.http.put<RespuestaApi>(`${this.API_URL}/${usuarioId}/estatus`, { estatus: nuevoEstatus })
      .pipe(catchError(this.manejarError));
  }

  /**
   * ====================================================================
   * MÉTODOS AUXILIARES Y MANEJO DE ERRORES
   * ====================================================================
   */

  private establecerSesion(respuesta: RespuestaAuth): void {
    localStorage.setItem('token_sigah', respuesta.token);
    localStorage.setItem('usuario_sigah', JSON.stringify(respuesta.usuario));
    this.usuarioActualSubject.next(respuesta.usuario);
  }

  private cargarUsuarioDesdeStorage(): void {
    const usuarioGuardado = localStorage.getItem('usuario_sigah');
    if (usuarioGuardado) {
      this.usuarioActualSubject.next(JSON.parse(usuarioGuardado));
    }
  }

  public obtenerToken(): string | null {
    return localStorage.getItem('token_sigah');
  }

  private manejarError(error: HttpErrorResponse) {
    let mensajeUsuario = 'Fallo en la autenticación o gestión de usuarios.';

    if (error.error instanceof ErrorEvent) {
      mensajeUsuario = `Fallo de red: ${error.error.message}`;
    } else {
      if (error.error && error.error.message) {
        mensajeUsuario = error.error.message;
      } else {
        switch (error.status) {
          case 400: mensajeUsuario = 'Las credenciales proporcionadas son inválidas.'; break;
          case 401: mensajeUsuario = 'Acceso denegado: OTP incorrecto o cuenta suspendida por inactividad.'; break;
          case 403: mensajeUsuario = 'Bloqueo Zero-Trust: No tienes los permisos necesarios para esta acción.'; break;
          case 404: mensajeUsuario = 'Usuario no encontrado en el sistema.'; break;
          case 429: mensajeUsuario = 'Demasiados intentos fallidos. Tu cuenta ha sido bloqueada temporalmente.'; break;
          case 500: mensajeUsuario = 'Fallo interno en el motor de autenticación.'; break;
        }
      }
    }

    return throwError(() => new Error(mensajeUsuario));
  }
}