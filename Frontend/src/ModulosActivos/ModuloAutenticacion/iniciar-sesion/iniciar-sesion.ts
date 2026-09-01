import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';

// Servicios Core
import { AuthService } from './../../../ServiciosActivos/auth.service';
// IMPORTANTE: Ajusta esta ruta a donde tengas realmente tu NotificacionesService
import { NotificacionesService } from '../../../ServiciosActivos/notificaciones.service';
import { BtnShared } from '../../ModuloComponentesActivos/btn-shared/btn-shared';
import { CampoEntradaShared } from '../../ModuloComponentesActivos/campo-entrada-shared/campo-entrada-shared';
import { TemaService } from '../../../ServiciosActivos/tema.service';

@Component({
  selector: 'app-iniciar-sesion',
  standalone: true,
  imports: [
    CommonModule, 
    ReactiveFormsModule, 
    CampoEntradaShared, 
    BtnShared
  ],
  templateUrl: './iniciar-sesion.html',
  styleUrls: ['./iniciar-sesion.scss']
})
export class IniciarSesion implements OnInit {

  public temaService = inject(TemaService);
  
  private fb = inject(FormBuilder);
  private authService = inject(AuthService);
  private router = inject(Router);
  private notificaciones = inject(NotificacionesService); 

  loginForm!: FormGroup;
  estaCargando = false;

  ngOnInit(): void {
    // Configuración del formulario reactivo
    this.loginForm = this.fb.group({
      correo: ['', [Validators.required]], 
      contrasena: ['', [Validators.required, Validators.minLength(6)]],
    });
  }

  // Getter rápido para acceder a los controles en el HTML
  get f() { return this.loginForm.controls; }

  iniciarSesion(): void { 
    if (this.loginForm.invalid) {
      this.loginForm.markAllAsTouched();
      this.notificaciones.mostrar('error', 'Datos Incompletos', 'Por favor, ingresa tu correo institucional y clave de acceso.');
      return;
    }

    this.estaCargando = true;
    let { correo, contrasena } = this.loginForm.value;

    if (!correo.includes('@')) {
      correo = `${correo.trim()}@itdurango.edu.mx`; 
    }

    // Llamamos al servicio de Firebase + Backend
    this.authService.iniciarSesion(correo, contrasena).subscribe({
      next: (respuesta: any) => { 
        // 1. Mostramos la bienvenida personalizada con el nombre del usuario
        const nombre = respuesta.usuarioActual?.nombreCompleto || 'Usuario';
        this.notificaciones.mostrar('exito', '¡Bienvenido!', `Hola ${nombre}, ingresando al sistema...`);
        
        // 2. Usamos tu método de redirección por rol con un ligero retraso para la animación
        setTimeout(() => {
          this.authService.redirigirPorRol(respuesta.rol);
        }, 1000);
      },
      error: (error) => {
        this.estaCargando = false;
        let tituloError = 'Error de Acceso';
        let mensajeError = 'Ocurrió un error inesperado. Verifique sus credenciales.';

        if (error.code === 'auth/invalid-credential' || error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') {
          mensajeError = 'Credenciales incorrectas. Verifique su matrícula o contraseña.';
        } else if (error.code === 'auth/too-many-requests') {
          mensajeError = 'Demasiados intentos fallidos. Cuenta bloqueada temporalmente.';
        }

        this.notificaciones.mostrar('error', tituloError, mensajeError);
      },
    });
  }

  recuperarAcceso(): void {
    // Te lleva al componente que haremos después para recuperar la clave
    this.router.navigate(['/recuperar-acceso']);
  }
}