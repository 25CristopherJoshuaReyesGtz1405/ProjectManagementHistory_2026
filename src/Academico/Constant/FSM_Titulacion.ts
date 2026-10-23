import { ConflictException } from '@nestjs/common';

export enum EstadoTitulacion {
  PASO_1_REGISTRO = '1_REGISTRO_INICIAL',
  PASO_3_TRIAGE_DOCS = '3_REVISION_DOCUMENTAL',
  PASO_4_PAGO_EXAMEN = '4_PENDIENTE_PAGO_1920',
  PASO_5_CARTA_NO_INCONVENIENCIA = '5_AUTORIZACION_PROTOCOLARIA',
  PASO_6_EXAMEN_PROGRAMADO = '6_EXAMEN_PROGRAMADO',
  PASO_7_FIRMAS_ACTA = '7_PENDIENTE_FIRMA_SINODAL',
  PASO_8_TRAMITE_SEP = '8_EN_TRAMITE_SEP_CEDULA',
  FINALIZADO_ENTREGADO = '9_TITULO_ENTREGADO'
}

// Grafo Dirigido Acíclico (DAG) para las transiciones
export const TransicionesPermitidas: Record<EstadoTitulacion, EstadoTitulacion[]> = {
  [EstadoTitulacion.PASO_1_REGISTRO]: [EstadoTitulacion.PASO_3_TRIAGE_DOCS],
  [EstadoTitulacion.PASO_3_TRIAGE_DOCS]: [EstadoTitulacion.PASO_4_PAGO_EXAMEN],
  [EstadoTitulacion.PASO_4_PAGO_EXAMEN]: [EstadoTitulacion.PASO_5_CARTA_NO_INCONVENIENCIA],
  [EstadoTitulacion.PASO_5_CARTA_NO_INCONVENIENCIA]: [EstadoTitulacion.PASO_6_EXAMEN_PROGRAMADO],
  [EstadoTitulacion.PASO_6_EXAMEN_PROGRAMADO]: [EstadoTitulacion.PASO_7_FIRMAS_ACTA],
  [EstadoTitulacion.PASO_7_FIRMAS_ACTA]: [EstadoTitulacion.PASO_8_TRAMITE_SEP],
  [EstadoTitulacion.PASO_8_TRAMITE_SEP]: [EstadoTitulacion.FINALIZADO_ENTREGADO],
  [EstadoTitulacion.FINALIZADO_ENTREGADO]: []
};

// Árbitro de Transición Estricto
export const validarTransicionFSM = (estadoActual: EstadoTitulacion, estadoDestino: EstadoTitulacion): void => {
  const destinosPermitidos = TransicionesPermitidas[estadoActual];
  if (!destinosPermitidos || !destinosPermitidos.includes(estadoDestino)) {
    throw new ConflictException(`Fallo de Integridad FSM: Transición ilegal de ${estadoActual} hacia ${estadoDestino}. Operación abortada.`);
  }
};