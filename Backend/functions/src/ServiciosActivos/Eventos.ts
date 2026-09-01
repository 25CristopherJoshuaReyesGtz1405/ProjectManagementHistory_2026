/**
 * ============================================================================
 * MÓDULO: BUS DE EVENTOS ASÍNCRONOS (Pub/Sub)
 * ============================================================================
 */
import { PubSub } from '@google-cloud/pubsub';

// Reutiliza la conexión del entorno de Google Cloud
const pubsub = new PubSub();

/**
 * @description Inyecta un mensaje en el Bus de Eventos (Event-Driven Architecture).
 */
export const publicarEventoBus = async (topicoId: string, payload: any): Promise<void> => {
  try {
    const dataBuffer = Buffer.from(JSON.stringify(payload));
    
    // publishMessage garantiza la entrega y libera el hilo principal (Non-blocking)
    const messageId = await pubsub.topic(topicoId).publishMessage({ data: dataBuffer });
    
    console.log(`[EVENT_BUS] Evento enrutado a ${topicoId}. MessageID: ${messageId}`);
  } catch (error) {
    // Si Pub/Sub falla, no tumbamos la transacción principal, pero alertamos a infraestructura
    console.error(`[ALERTA_INFRA] Fallo al publicar en el bus de eventos (${topicoId}):`, error);
  }
};