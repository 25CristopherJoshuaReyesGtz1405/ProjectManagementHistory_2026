import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class TemaService {
  // BehaviorSubject para que cualquier componente (como un switch de luna/sol) sepa el estado actual
  private esOscuroSubject = new BehaviorSubject<boolean>(false);
  public esOscuro$ = this.esOscuroSubject.asObservable();

  constructor() {
    this.inicializarTema();
  }

  private inicializarTema() {
    // 1. Revisar si el usuario ya tiene una preferencia guardada
    const temaGuardado = localStorage.getItem('sigah_tema');
    
    if (temaGuardado) {
      this.aplicarTema(temaGuardado === 'dark');
    } else {
      // 2. Si no hay preferencia, detectar el tema del sistema operativo (Windows/Mac)
      const prefiereOscuro = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
      this.aplicarTema(prefiereOscuro);
    }
  }

  /**
   * Método público para cambiar entre claro y oscuro (se llama desde un botón)
   */
  alternarTema() {
    this.aplicarTema(!this.esOscuroSubject.value);
  }

  /**
   * Aplica la clase al body y guarda en memoria
   */
  private aplicarTema(hacerOscuro: boolean) {
    this.esOscuroSubject.next(hacerOscuro);
    localStorage.setItem('sigah_tema', hacerOscuro ? 'dark' : 'light');

    if (hacerOscuro) {
      document.body.classList.add('dark-theme');
    } else {
      document.body.classList.remove('dark-theme');
    }
  }
}