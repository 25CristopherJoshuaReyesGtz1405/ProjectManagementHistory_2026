import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../../ServiciosActivos/auth.service';

export const rolGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  // Leemos el rol que exige la ruta
  const rolRequerido = route.data['rolRequerido'] as string;

  // Obtenemos el usuario actual en memoria
  const usuario = authService.getUsuarioSnapshot();

  if (usuario && usuario.rol === rolRequerido) {
    return true; // Pasa sin problemas
  } else if (usuario) {
    // Tiene sesión pero no es su área. Lo regresamos a su casa.
    authService.redirigirPorRol(usuario.rol);
    return false;
  } else {
    // No tiene sesión, va para el login
    return router.createUrlTree(['/login']); // <-- Ajustado aquí
  }
};