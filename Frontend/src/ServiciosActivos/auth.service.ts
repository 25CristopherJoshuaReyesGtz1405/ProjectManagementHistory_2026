import { Injectable, inject, signal, computed } from '@angular/core';
import { Router } from '@angular/router';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, from, throwError } from 'rxjs';
import { catchError, map, switchMap, tap } from 'rxjs/operators';
import { environment } from './../ConfiguracionesActivas/AmbienteTrabajo/enviroments';
import { PerfilUsuarioDTO } from './../ModelosActivos/ModelosAplicacion.model';

import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword, signOut, onIdTokenChanged, sendPasswordResetEmail } from 'firebase/auth';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private router = inject(Router);
  private http = inject(HttpClient);

  private app = initializeApp(environment.firebaseConfig);
  private fireAuth = getAuth(this.app);
  private apiUrl = environment.apiUrl;

  // 1. ESTADO GLOBAL REACTIVO CON SIGNALS (Cero fugas de memoria)
  private perfilSignal = signal<PerfilUsuarioDTO | null>(null);

  // Señales computadas derivadas (Se actualizan mágicamente si el perfilSignal cambia)
  public usuarioActual = computed(() => this.perfilSignal());
  public estaAutenticado = computed(() => this.perfilSignal() !== null);
  public rolActual = computed(() => this.perfilSignal()?.rol || null);

  constructor() {
    onIdTokenChanged(this.fireAuth, async (user) => {
      if (user) {
        const token = await user.getIdToken();
        localStorage.setItem('authToken', token);
        
        // Rehidratación inteligente (FinOps: Evita consultar a Node.js si el signal ya tiene datos)
        if (!this.perfilSignal()) {
          this.rehidratarPerfilGlobal(user.uid);
        }
      } else {
        this.limpiarSesionLocal();
      }
    });
  }

  // 2. INICIO DE SESIÓN INTEGRAL (Flujo RxJS Declarativo y Limpio)
  iniciarSesion(email: string, password: string): Observable<PerfilUsuarioDTO> {
    return from(signInWithEmailAndPassword(this.fireAuth, email, password)).pipe(
      switchMap(credencial => from(credencial.user.getIdToken()).pipe(
        tap(token => localStorage.setItem('authToken', token)),
        map(token => ({ uid: credencial.user.uid, token }))
      )),
      switchMap(({ uid, token }) => {
        const headers = new HttpHeaders().set('Authorization', `Bearer ${token}`);
        return this.http.get<any>(`${this.apiUrl}/usuarios/administrativos/${uid}`, { headers });
      }),
      map(datosBackend => this.adaptarPerfil(datosBackend)),
      tap(perfil => this.perfilSignal.set(perfil)),
      catchError(error => {
        this.limpiarSesionLocal();
        return throwError(() => error);
      })
    );
  }

  // 3. ENRUTADOR ESTRATÉGICO
  redirigirPorRol(tipoRol: PerfilUsuarioDTO['rol'] | null): void {
    const rutas: Record<string, string> = {
      'ADMIN': '/admin',
      'JEFATURA': '/jefatura',
      'CAPTURISTA': '/capturista',
      'VENTANILLA': '/ventanilla'
    };
    this.router.navigate([rutas[tipoRol || ''] || '/login']);
  }

  recuperarPassword(email: string): Observable<void> {
    return from(sendPasswordResetEmail(this.fireAuth, email));
  }

  async cerrarSesion(): Promise<void> {
    try {
      await signOut(this.fireAuth);
    } catch (error) {
      console.error('[AUTH_ERROR] Fallo al desconectar Firebase:', error);
    } finally {
      this.limpiarSesionLocal();
      this.router.navigate(['/login']);
    }
  }

  obtenerTokenActual(): string | null {
    return localStorage.getItem('authToken');
  }

  // 4. AISLAMIENTO DE LÓGICA ESTRUCTURAL
  private limpiarSesionLocal(): void {
    localStorage.removeItem('authToken');
    this.perfilSignal.set(null);
  }

  private rehidratarPerfilGlobal(uid: string): void {
    this.http.get<any>(`${this.apiUrl}/usuarios/administrativos/${uid}`).subscribe({
      next: (datosBackend) => this.perfilSignal.set(this.adaptarPerfil(datosBackend)),
      error: () => this.limpiarSesionLocal()
    });
  }

  private adaptarPerfil(datosBackend: any): PerfilUsuarioDTO {
    return {
      usuarioActual: {
        uid: datosBackend.uid,
        email: datosBackend.correo,
        nombreCompleto: datosBackend.nombre,
        rol: datosBackend.rol,
        departamento: datosBackend.departamento,
        fechaCreacion: datosBackend.metadata?.fechaCreacion,
        activo: datosBackend.estatus === 'ACTIVO'
      },
      rol: datosBackend.rol,
      personaActual: null
    };
  }
}