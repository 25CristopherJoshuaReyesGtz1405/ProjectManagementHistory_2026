import { Component, inject, OnInit, HostListener, EventEmitter, Output } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { Observable } from 'rxjs';
import { PerfilUsuarioDTO } from '../../../../ModelosActivos/ModelosAplicacion.model';
import { AuthService } from '../../../../ServiciosActivos/auth.service';
import { TemaService } from '../../../../ServiciosActivos/tema.service';


@Component({
  selector: 'app-panel-superior-ventanilla',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './panel-superior-ventanilla.html',
  styleUrls: ['./panel-superior-ventanilla.scss'],
})
export class PanelSuperiorVentanilla implements OnInit 
{
  private authService = inject(AuthService);
  public temaService = inject(TemaService);
  private router = inject(Router);

  usuario$: Observable<PerfilUsuarioDTO | null>;
  isProfileMenuOpen = false;

  @Output() toggleSidebar = new EventEmitter<void>();

  onToggleSidebar(): void {
    this.toggleSidebar.emit();
  }

  constructor() {
    this.usuario$ = this.authService.getUsuario();
  }

  ngOnInit(): void {}

  toggleProfileMenu(event: Event): void {
    event.stopPropagation();
    this.isProfileMenuOpen = !this.isProfileMenuOpen;
  }

  @HostListener('document:click')
  onDocumentClick() {
    if (this.isProfileMenuOpen) {
      this.isProfileMenuOpen = false;
    }
  }

  async logout(): Promise<void> {
    try {
      await this.authService.cerrarSesion();
      this.isProfileMenuOpen = false;
    } catch (error) {
      console.error('Error al cerrar sesión:', error);
    }
  }
}