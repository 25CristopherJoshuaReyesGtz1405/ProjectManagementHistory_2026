import { Component, EventEmitter, Input, Output, forwardRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ControlValueAccessor, NG_VALUE_ACCESSOR, FormsModule } from '@angular/forms';

@Component({
  selector: 'app-campo-entrada-shared',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './campo-entrada-shared.html',
  styleUrls: ['./campo-entrada-shared.scss'],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => CampoEntradaShared),
      multi: true
    }
  ]
})
export class CampoEntradaShared implements ControlValueAccessor
 {
  @Input() label: string = 'Label';
  @Input() type: string = 'text';
  @Input() iconClass: string = ''; // ej. 'bi bi-envelope'

  // Esto es para que funcione el [(ngModel)]
  @Input() value: string = '';
  @Output() valueChange = new EventEmitter<string>();

  onValueChange(newValue: string) {
    this.value = newValue;
    this.valueChange.emit(this.value);
  }

  // --- LÓGICA INTERNA DEL CONTROLVALUEACCESSOR ---
  
  value1: string = '';
  isDisabled: boolean = false;
  
  // Estas son las funciones que Angular usará para comunicarse
  onChange = (value: any) => {};
  onTouched = () => {};

  // Cuando el valor cambia desde el formulario "padre"
  writeValue(value: any): void {
    this.value1 = value;
  }

  // Registra la función 'onChange' que debemos llamar cuando el valor cambia internamente
  registerOnChange(fn: any): void {
    this.onChange = fn;
  }

  // Registra la función 'onTouched' que debemos llamar cuando el usuario "toca" el input
  registerOnTouched(fn: any): void {
    this.onTouched = fn;
  }

  // Establece el estado de deshabilitado
  setDisabledState?(isDisabled: boolean): void {
    this.isDisabled = isDisabled;
  }

  // Se llama cuando el valor del input en nuestro HTML cambia
  onInputChange(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.onChange(value);
    this.onTouched();
  }
}
