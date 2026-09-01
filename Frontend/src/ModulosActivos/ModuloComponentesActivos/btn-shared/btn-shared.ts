import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-btn-shared',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './btn-shared.html',
  styleUrls: ['./btn-shared.scss']
})

export class BtnShared 
{
  @Input() text: string = 'Botón';
  @Input() iconClass: string = '';
  @Input() variant: 'solid' | 'outline' = 'solid'; 
  @Input() disabled: boolean = false;

  @Output() onClick = new EventEmitter<void>();

  onButtonClick() {
    this.onClick.emit();
  }
}
