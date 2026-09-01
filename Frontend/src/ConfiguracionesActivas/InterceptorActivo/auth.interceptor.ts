import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { AuthService } from './../../ServiciosActivos/auth.service';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { NotificacionesService } from '../../ServiciosActivos/notificaciones.service';


export const authInterceptor: HttpInterceptorFn = (req, next) => 
{
  // 1. Inyectamos los servicios necesarios
  const authService = inject(AuthService); 
  const NotificacionService = inject(NotificacionesService); // <-- Inyectamos el servicio de notificaciones

  // const snackBar = inject(MatSnackBar); // <-- Para mostrar el mensaje visualmente

  // 2. Le pedimos al servicio el token
  const token = authService.obtenerTokenActual(); 

  // 3. Clonamos la petición si hay token
  let reqClonada = req;
  if (token && !req.url.includes('firebase')) {
    reqClonada = req.clone({
      headers: req.headers.set('Authorization', `Bearer ${token}`)
    });
  }

  // 4. Enviamos la petición y escuchamos la RESPUESTA
  return next(reqClonada).pipe(
    catchError((error: HttpErrorResponse) => {
      
      let mensajeAmigable = 'Ocurrió un error inesperado en el sistema. Por favor, intenta de nuevo.';

      // Traducimos los errores del backend a un lenguaje de hospitalidad y servicio
      if (error.status === 404) {
        mensajeAmigable = 'No encontramos ese registro en el acervo activo. ¿Deseas verificar si hay un error tipográfico?';
      } 
      else if (error.status === 401 || error.status === 403) {
        mensajeAmigable = 'Parece que tu sesión ha expirado o necesitas permisos adicionales. Vamos a iniciar sesión nuevamente.';
        // Opcional: authService.cerrarSesion();
      } 
      else if (error.status === 400) {
        // Aprovechamos los mensajes personalizados que envía tu validador Zod y AppError
        mensajeAmigable = error.error?.message || 'Hay un pequeño detalle con los datos ingresados. Por favor, revísalos.';
      } 
      else if (error.status === 500) {
        mensajeAmigable = 'Nuestros servidores están procesando mucha información. Intenta de nuevo en unos segundos.';
      }

      // 5. Mostramos el mensaje en la interfaz (Ejemplo con Snackbar de Material)
      
      NotificacionService.mostrar('error', 'Problema de comunicación', mensajeAmigable);
      
      
      console.error('[SIGAH Interceptor]', mensajeAmigable, error);

      // Propagamos el error por si el componente específico necesita hacer algo más
      return throwError(() => error);
    })
  );
};