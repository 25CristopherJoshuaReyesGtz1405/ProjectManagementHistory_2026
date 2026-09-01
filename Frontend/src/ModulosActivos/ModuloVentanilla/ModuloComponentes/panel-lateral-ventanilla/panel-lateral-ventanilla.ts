import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router'; // Mejor usar RouterModule completo

@Component({
  selector: 'app-panel-lateral-ventanilla',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './panel-lateral-ventanilla.html',
  styleUrls: ['./panel-lateral-ventanilla.scss'],
})
export class PanellateralVentanilla 
{
  @Input() isMobileOpen: boolean = false;
  @Output() closeMobileMenu = new EventEmitter<void>();
  estaColapsado: boolean = false;

  alternarSidebar(): void {
    this.estaColapsado = !this.estaColapsado;
  }

  handleLinkClick(): void {
    if (this.isMobileOpen) {
      this.closeMobileMenu.emit();
    }
  }
}