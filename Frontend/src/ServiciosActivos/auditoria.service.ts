import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from './../ConfiguracionesActivas/AmbienteTrabajo/enviroments';

@Injectable({
  providedIn: 'root'
})
export class AuditoriaService {
  private http = inject(HttpClient);
  private apiUrl = `${environment.apiUrl}/auditoria`;

  obtenerLogsRecientes(): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/recientes`);
  }
}