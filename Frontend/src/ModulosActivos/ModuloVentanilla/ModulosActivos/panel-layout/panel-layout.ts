import { Component } from '@angular/core';
import { PanelSuperiorVentanilla } from '../../ModuloComponentes/panel-superior-ventanilla/panel-superior-ventanilla';
import { PanellateralVentanilla } from '../../ModuloComponentes/panel-lateral-ventanilla/panel-lateral-ventanilla';
import { RouterOutlet } from '@angular/router';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-panel-layout',
  imports: [CommonModule, RouterOutlet, PanelSuperiorVentanilla, PanellateralVentanilla],
  templateUrl: './panel-layout.html',
  styleUrl: './panel-layout.scss',
})
export class PanelLayout {
  isMobileMenuOpen: boolean = false;

  toggleMobileMenu(): void {
    this.isMobileMenuOpen = !this.isMobileMenuOpen;
  }
}
