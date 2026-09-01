import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';

// Servicios
import { NotificacionesService } from '../../../ServiciosActivos/notificaciones.service';
import { AuthService } from '../../../ServiciosActivos/auth.service';
import { BtnShared } from '../../ModuloComponentesActivos/btn-shared/btn-shared';
import { CampoEntradaShared } from '../../ModuloComponentesActivos/campo-entrada-shared/campo-entrada-shared';


@Component({
  selector: 'app-recuperar-acceso',
  standalone: true,
  imports: [
    CommonModule, 
    ReactiveFormsModule, 
    RouterLink, // Necesario para el enlace de "Volver al inicio"
    CampoEntradaShared, 
    BtnShared
  ],
  templateUrl: './recuperar-acceso.html',
  styleUrls: ['./recuperar-acceso.scss']
})
export class RecuperarAcceso implements OnInit {
  
  private fb = inject(FormBuilder);
  private authService = inject(AuthService);
  public router = inject(Router);
  private notificaciones = inject(NotificacionesService);

  recuperarForm!: FormGroup;
  estaCargando = false;
  correoEnviado = false; // Bandera para cambiar la vista cuando se envía el correo

  ngOnInit(): void {
    this.recuperarForm = this.fb.group({
      correo: ['', [Validators.required, Validators.email]]
    });
  }

  get f() { return this.recuperarForm.controls; }

  solicitarRecuperacion(): void {
    if (this.recuperarForm.invalid) {
      this.recuperarForm.markAllAsTouched();
      this.notificaciones.mostrar('error', 'Formato Inválido', 'Por favor ingresa un correo electrónico válido.');
      return;
    }

    this.estaCargando = true;
    let { correo } = this.recuperarForm.value;

    // Autocompletado si el usuario solo pone su matrícula
    if (!correo.includes('@')) {
      correo = `${correo.trim()}@itdurango.edu.mx`; 
    }

    this.authService.recuperarPassword(correo).subscribe({
      next: () => {
        this.estaCargando = false;
        this.notificaciones.mostrar('exito', 'Enlace Enviado', `Revisa la bandeja de entrada de ${correo} para restablecer tu contraseña.`);
                this.correoEnviado = true; // Cambia la interfaz a modo éxito

      },
      error: (error) => {
        this.estaCargando = false;
        let msg = 'Hubo un problema al intentar enviar el correo. Intenta de nuevo más tarde.';
        
        // Manejo de errores específicos de Firebase
        if (error.code === 'auth/user-not-found') {
          msg = 'No existe ninguna cuenta registrada con este correo.';
        } else if (error.code === 'auth/invalid-email') {
          msg = 'El formato del correo electrónico no es correcto.';
        }

        this.notificaciones.mostrar('error', 'Error al recuperar', msg);
      }
    });
  }
}