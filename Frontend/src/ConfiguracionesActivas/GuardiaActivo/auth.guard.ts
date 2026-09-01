import { inject } from '@angular/core';
import { Router, CanActivateFn } from '@angular/router';
import { AuthService } from './../../ServiciosActivos/auth.service';

export const authGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  // Le preguntamos a nuestro servicio si hay un token válido
  if (authService.estaAutenticado()) {
    return true; // Déjalo pasar
  }

  // Si no está autenticado, lo mandamos al login
  router.navigate(['/login']);
  return false;
};