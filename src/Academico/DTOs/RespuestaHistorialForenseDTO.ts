export type SeveridadEvento = 'INFO' | 'WARNING' | 'CRITICAL' | 'SUCCESS';

export class EventoForense {
  idEvento: string;
  tipoModulo: string; // Ej. 'PRESTAMO', 'TITULACION', 'SEGURIDAD', 'DIGITALIZACION'
  fechaTimestamp: Date;
  actorPrincipal: string; // ¿Quién lo hizo? (Nombre del admin, maestro, o sistema)
  descripcion: string; // Ej. "El expediente fue extraído de la bóveda física"
  severidad: SeveridadEvento;
  metadatosAdicionales?: Record<string, any>; // JSON con detalles extra
}

export class RespuestaHistorialForenseDTO {
  numControl: string;
  fechaConsulta: Date;
  totalEventos: number;
  lineaDeTiempo: EventoForense[];
}