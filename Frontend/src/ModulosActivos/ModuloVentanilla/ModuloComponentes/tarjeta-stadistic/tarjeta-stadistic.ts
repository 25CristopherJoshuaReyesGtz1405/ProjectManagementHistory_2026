import { Component, Input, HostBinding } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-tarjeta-stadistic',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './tarjeta-stadistic.html',
  styleUrl: './tarjeta-stadistic.scss'
})
export class TarjetaStadistic {
  
  // Datos Principales
  @Input() titulo: string = 'Métrica';
  @Input() valor: number | string = 0;
  @Input() icono: string = ''; 
  @Input() iconoPrincipal: string = ''; // Soporte para la 3ra y 4ta tarjeta

  // Datos Secundarios
  @Input() tendenciaTexto: string = '';
  @Input() iconoTendencia: string = '';
  @Input() progreso: number = 0; 
  @Input() footerIcono: string = '';
  @Input() descripcion: string = ''; 

  // Clases Estilizadas Personalizadas (Tu HTML)
  @Input() claseFondoIcono: string = '';
  @Input() claseColorIcono: string = '';
  @Input() iconoMarcaAgua: string = ''; 
  
  // Control de Animaciones directamente desde el HTML
  @Input() delayAnimacion: string = '';

  @HostBinding('class') get hostClasses() {
    // Inyecta la animación y el delay al contenedor padre dinámicamente
    return `animate-slide-up ${this.delayAnimacion}`;
  }

  // Getters para unificar tus variables
  get iconToUse() {
    return this.icono || this.iconoPrincipal || 'bi-bar-chart';
  }

  get watermarkToUse() {
    return this.iconoMarcaAgua || this.iconToUse;
  }

  get baseColor() {
    switch(this.claseColorIcono) {
      case 'azul': return 'blue';
      case 'verde': return 'teal'; 
      case 'morado': return 'purple';
      case 'dorado': return 'gold'; // Adaptado al dorado institucional
      case 'rojo': return 'red';
      case 'guinda': return 'guinda';
      default: return 'blue';
    }
  }
}