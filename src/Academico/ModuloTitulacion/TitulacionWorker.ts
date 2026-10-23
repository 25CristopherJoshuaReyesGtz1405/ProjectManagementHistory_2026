import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { TramiteTitulacionEntity } from '../Entities/TramiteTitulacionEntity.js';


@Processor('titulacion-queue')
export class TitulacionWorker extends WorkerHost {
  private readonly logger = new Logger(TitulacionWorker.name);

  constructor(private readonly dataSource: DataSource) {
    super();
  }

  async process(job: Job<any, any, string>): Promise<any> {
    const { tipoEvento, data } = job.data;

    switch (tipoEvento) {
      case 'NUEVA_CEDULA_HISTORICA_DIGITALIZADA':
        this.logger.log(`[RPA_WORKER] Validando cédula ${data.cedula} ante la SEP para trámite ${data.idTramite}`);
        await this.validarCedulaSEPBackground(data.idTramite, data.cedula);
        break;
      
      // Aquí puedes agregar el 'DISPARO_OCR_AUTOMATICO' en el futuro
      
      default:
        this.logger.warn(`[RPA_WORKER] Evento desconocido: ${tipoEvento}`);
    }
  }

  /**
   * Simula la validación gubernamental mediante RPA / Web Scraping
   */
  private async validarCedulaSEPBackground(idTramite: string, cedula: string) {
    // 1. Simulación de latencia hacia el Registro Nacional de Profesionistas (SEP)
    await new Promise(resolve => setTimeout(resolve, 1500));
    const esValidaAnteSEP = true; // Simulación de éxito

    // 2. Operación de actualización en PostgreSQL
    const tramiteRepo = this.dataSource.getRepository(TramiteTitulacionEntity);
    const tramite = await tramiteRepo.findOne({ where: { idTramite } });

    if (!tramite) {
      this.logger.error(`[RPA_WORKER] El trámite ${idTramite} desapareció de la base de datos.`);
      return;
    }

    if (esValidaAnteSEP) {
      const historial = tramite.datosHistoricosSep || {};
      historial['verificadoPorRPA'] = true;
      historial['fechaVerificacionSEP'] = new Date().toISOString();
      historial['cedulaValidada'] = cedula;

      tramite.datosHistoricosSep = historial;
      
      // Al guardar, el @VersionColumn se incrementará automáticamente (OCC)
      await tramiteRepo.save(tramite);
      this.logger.log(`[RPA_WORKER] ✅ Cédula ${cedula} validada correctamente y sellada en la BD.`);
    } else {
      this.logger.error(`[RPA_WORKER] 🚨 ALERTA: La cédula ${cedula} es apócrifa o no coincide con los registros SEP.`);
      // Aquí inyectarías la lógica para enviar a Cuarentena
    }
  }
}