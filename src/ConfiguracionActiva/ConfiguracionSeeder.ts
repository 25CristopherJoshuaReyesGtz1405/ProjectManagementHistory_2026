import { Injectable, OnApplicationBootstrap, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { CatalogoCarreraEntity } from './Entities/CatalogoCarreraEntity.js';
import { CatalogoEstatusExpedienteEntity } from './Entities/CatalogoEstatusExpedienteEntity.js';
import { CatalogoNivelAcademicoEntity } from './Entities/CatalogoNivelAcademicoEntity.js';

@Injectable()
export class ConfiguracionSeederService implements OnApplicationBootstrap {
  private readonly logger = new Logger('DatabaseSeeder');

  constructor(
    @InjectRepository(CatalogoCarreraEntity)
    private carreraRepo: Repository<CatalogoCarreraEntity>,
    @InjectRepository(CatalogoNivelAcademicoEntity)
    private nivelRepo: Repository<CatalogoNivelAcademicoEntity>,
    @InjectRepository(CatalogoEstatusExpedienteEntity)
    private estatusRepo: Repository<CatalogoEstatusExpedienteEntity>,
  ) {}

  // Este método se ejecuta automáticamente cuando NestJS termina de arrancar
  async onApplicationBootstrap() {
    this.logger.log('Iniciando protocolo de siembra de datos maestros (Data Seeding)...');
    await this.sembrarNivelesAcademicos();
    await this.sembrarCarreras();
    await this.sembrarEstatusExpediente();
    this.logger.log('Protocolo de siembra finalizado con éxito.');
  }

  private async sembrarNivelesAcademicos() {
    const conteo = await this.nivelRepo.count();
    if (conteo === 0) {
      const niveles = [
        this.nivelRepo.create({ nombre: 'Preparatoria' }),
        this.nivelRepo.create({ nombre: 'Licenciatura' }),
        this.nivelRepo.create({ nombre: 'Maestría' }),
        this.nivelRepo.create({ nombre: 'Doctorado' }),
      ];
      await this.nivelRepo.save(niveles);
      this.logger.log('✔️ Catálogo de Niveles Académicos poblado.');
    }
  }

  private async sembrarCarreras() {
    const conteo = await this.carreraRepo.count();
    if (conteo === 0) {
      const carreras = [
        this.carreraRepo.create({ clave: 'ISC',  nombre: 'Ingeniería en Sistemas Computacionales', activo: true }),
        this.carreraRepo.create({ clave: 'IIA',  nombre: 'Ingeniería en Inteligencia Artificial', activo: true }),
        this.carreraRepo.create({ clave: 'II',   nombre: 'Ingeniería en Informática', activo: true }),
        this.carreraRepo.create({ clave: 'TICS', nombre: 'Ingeniería en Tecnologías De La Información y Comunicación', activo: true }),
        
        this.carreraRepo.create({ clave: 'IBQ',  nombre: 'Ingeniería en Bioquímica', activo: true }),
        this.carreraRepo.create({ clave: 'IQ',   nombre: 'Ingeniería en Química', activo: true }),
        
        this.carreraRepo.create({ clave: 'IE',   nombre: 'Ingeniería en Eléctrica', activo: true }),
        this.carreraRepo.create({ clave: 'IEC',  nombre: 'Ingeniería en Electrónica', activo: true }),
        this.carreraRepo.create({ clave: 'IBM',  nombre: 'Ingeniería en Biomédica', activo: true }),
        this.carreraRepo.create({ clave: 'IS',   nombre: 'Ingeniería en Semiconductores', activo: true }),
        
        this.carreraRepo.create({ clave: 'II',   nombre: 'Ingeniería en Industrial', activo: true }),

        this.carreraRepo.create({ clave: 'IM',   nombre: 'Ingeniería en Mecánica', activo: true }),
        this.carreraRepo.create({ clave: 'IMC',  nombre: 'Ingeniería en Mecatrónica', activo: true }),

        this.carreraRepo.create({ clave: 'ARQ',  nombre: 'Arquitectura', activo: true }),
        this.carreraRepo.create({ clave: 'IC',   nombre: 'Ingeniería Civil', activo: true }),

        this.carreraRepo.create({ clave: 'LA',   nombre: 'Licenciatura en Administración', activo: true }),
        this.carreraRepo.create({ clave: 'IGE',  nombre: 'Ingeniería en Gestión Empresarial', activo: true }),
        this.carreraRepo.create({ clave: 'IL',   nombre: 'Ingeniería en Logística', activo: true }),
      ];
      await this.carreraRepo.save(carreras);
      this.logger.log('✔️ Catálogo de Carreras poblado.');
    }
  }

  private async sembrarEstatusExpediente() {
    const conteo = await this.estatusRepo.count();
    if (conteo === 0) {
      const estatus = [
        this.estatusRepo.create({ nombre: 'Activo en Archivo Trámite' }),
        this.estatusRepo.create({ nombre: 'Transferido a Archivo Concentración' }),
        this.estatusRepo.create({ nombre: 'Baja Definitiva' }),
      ];
      await this.estatusRepo.save(estatus);
      this.logger.log('✔️ Catálogo de Estatus de Expediente poblado.');
    }
  }
}