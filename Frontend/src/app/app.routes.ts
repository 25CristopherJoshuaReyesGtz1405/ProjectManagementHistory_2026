import { Routes } from '@angular/router';
import { rolGuard } from '../ConfiguracionesActivas/GuardiaActivo/rol.guard';
import { PanelPrincipal } from '../ModulosActivos/ModuloVentanilla/ModulosActivos/panel-principal/panel-principal';
import { DigitalizadorOcr } from '../ModulosActivos/ModuloVentanilla/ModulosActivos/digitalizador-ocr/digitalizador-ocr';

export const routes: Routes = [
  { path: '', redirectTo: 'login', pathMatch: 'full' },
  {
    path: 'login',
    loadComponent: () => import('./../ModulosActivos/ModuloAutenticacion/iniciar-sesion/iniciar-sesion').then(m => m.IniciarSesion)
  },

  {
    path: 'pruebabeta',
    loadComponent: () => import('./../ModulosActivos/ModulosAvanzados/explorador-phygital/explorador-phygital').then(m => m.ExploradorPhygital)
  },


  {
    path: 'recuperar-acceso',
    loadComponent: () => import('./../ModulosActivos/ModuloAutenticacion/recuperar-acceso/recuperar-acceso').then(m => m.RecuperarAcceso)
  },

  // ==========================================================
  // RUTAS BLINDADAS POR EL ROL GUARD
  // ==========================================================
  
  {
    path: 'ventanilla',
    canActivate: [rolGuard],
    data: { rolRequerido: 'VENTANILLA' }, // o 'CAPTURISTA', según tu base de datos
    loadComponent: () => import('./../ModulosActivos/ModuloVentanilla/ModulosActivos/panel-layout/panel-layout').then(m => m.PanelLayout),
    children: [
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
      { 
        path: 'dashboard', 
        loadComponent: () => import('../ModulosActivos/ModuloVentanilla/ModulosActivos/panel-principal/panel-principal').then(m => m.PanelPrincipal) 
      },
      { 
        path: 'digitalizacion', 
        loadComponent: () => import('../ModulosActivos/ModuloVentanilla/ModulosActivos/digitalizador-ocr/digitalizador-ocr').then(m => m.DigitalizadorOcr) 
      },
    ]
  },

  /*{
    path: 'admin',
    // 1. Ponemos a tu guardián en la puerta
    canActivate: [rolGuard],
    // 2. Le pasamos el "gafete" que debe exigir
    data: { rolRequerido: 'ADMIN' }, 
    //loadComponent: () => import('./modulos/admin/layout-admin/layout-admin.component').then(m => m.LayoutAdminComponent),
    // Aquí adentro irán las "rutas hijas" (ej. /admin/usuarios, /admin/estadisticas)
    children: [] 
  },

  {
    path: 'jefatura',
    canActivate: [rolGuard],
    data: { rolRequerido: 'JEFATURA' },
    //loadComponent: () => import('./modulos/jefatura/layout-jefatura/layout-jefatura.component').then(m => m.LayoutJefaturaComponent),
    children: []
  },*/

  { path: '**', redirectTo: 'login' }
];