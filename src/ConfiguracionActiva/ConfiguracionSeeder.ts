import { Injectable, OnApplicationBootstrap, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CatalogoCarreraEntity } from './Entities/CatalogoCarreraEntity.js';
import { CatalogoEstatusExpedienteEntity } from './Entities/CatalogoEstatusExpedienteEntity.js';
import { CatalogoNivelAcademicoEntity } from './Entities/CatalogoNivelAcademicoEntity.js';
import { CatalogoRolUsuarioEntity } from './Entities/CatalogoRolUsuarioEntity.js';
import { CatalogoEstatusPrestamoEntity } from './Entities/CatalogoEstatusPrestamoEntity.js';
import { CatalogoMotivoPrestamoEntity } from './Entities/CatalogoMotivoPrestamoEntity.js';
import { CatalogoEstadoConservacionEntity } from './Entities/CatalogoEstadoConservacionEntity.js';
import { CatalogoTipoArchivoEntity } from './Entities/CatalogoTipoArchivoEntity.js';

@Injectable()
export class ConfiguracionSeederService implements OnApplicationBootstrap {
  private readonly logger = new Logger('DatabaseSeeder');

  constructor(
    @InjectRepository(CatalogoCarreraEntity)
    private carreraRepo: Repository<CatalogoCarreraEntity>,
    @InjectRepository(CatalogoNivelAcademicoEntity)
    private nivelRepo: Repository<CatalogoNivelAcademicoEntity>,
    @InjectRepository(CatalogoEstatusExpedienteEntity)
    private estatusExpRepo: Repository<CatalogoEstatusExpedienteEntity>,
    @InjectRepository(CatalogoRolUsuarioEntity)
    private rolRepo: Repository<CatalogoRolUsuarioEntity>,
    @InjectRepository(CatalogoEstatusPrestamoEntity)
    private estatusPrestamoRepo: Repository<CatalogoEstatusPrestamoEntity>,
    @InjectRepository(CatalogoMotivoPrestamoEntity)
    private motivoPrestamoRepo: Repository<CatalogoMotivoPrestamoEntity>,
    @InjectRepository(CatalogoEstadoConservacionEntity)
    private conservacionRepo: Repository<CatalogoEstadoConservacionEntity>,
    @InjectRepository(CatalogoTipoArchivoEntity)
    private tipoArchivoRepo: Repository<CatalogoTipoArchivoEntity>,
  ) {}

  async onApplicationBootstrap() {
    this.logger.log('Iniciando protocolo de siembra maestra (Auto-Backup de Catálogos ITD)...');
    await this.sembrarRolesUsuario();
    await this.sembrarNivelesAcademicos();
    await this.sembrarCarreras();
    await this.sembrarEstatusExpediente();
    await this.sembrarEstatusPrestamo();
    await this.sembrarMotivosPrestamo();
    await this.sembrarEstadosConservacion();
    await this.sembrarTiposArchivo();
    this.logger.log('Protocolo de siembra finalizado con éxito.');
  }

  private async sembrarRolesUsuario() {
    if ((await this.rolRepo.count()) === 0) {
      await this.rolRepo.save([
        this.rolRepo.create({ nombre: 'ADMIN' }),
        this.rolRepo.create({ nombre: 'JEFATURA' }),
        this.rolRepo.create({ nombre: 'TITULACION' }),
        this.rolRepo.create({ nombre: 'VENTANILLA' }),
        this.rolRepo.create({ nombre: 'SERVICIO_SOCIAL' }),
      ]);
      this.logger.log('Catálogo de Roles de Usuario (Servicios Escolares) poblado.');
    }
  }

  private async sembrarNivelesAcademicos() {
    if ((await this.nivelRepo.count()) === 0) {
      await this.nivelRepo.save([
        this.nivelRepo.create({ nombre: 'Preparatoria' }),
        this.nivelRepo.create({ nombre: 'Licenciatura' }),
        this.nivelRepo.create({ nombre: 'Maestría' }),
        this.nivelRepo.create({ nombre: 'Doctorado' }),
      ]);
      this.logger.log('Catálogo de Niveles Académicos poblado.');
    }
  }

  private async sembrarCarreras() {
    if ((await this.carreraRepo.count()) === 0) {
      await this.carreraRepo.save([
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
        this.carreraRepo.create({ clave: 'IIND', nombre: 'Ingeniería en Industrial', activo: true }),
        this.carreraRepo.create({ clave: 'IM',   nombre: 'Ingeniería en Mecánica', activo: true }),
        this.carreraRepo.create({ clave: 'IMC',  nombre: 'Ingeniería en Mecatrónica', activo: true }),
        this.carreraRepo.create({ clave: 'ARQ',  nombre: 'Arquitectura', activo: true }),
        this.carreraRepo.create({ clave: 'IC',   nombre: 'Ingeniería Civil', activo: true }),
        this.carreraRepo.create({ clave: 'LA',   nombre: 'Licenciatura en Administración', activo: true }),
        this.carreraRepo.create({ clave: 'IGE',  nombre: 'Ingeniería en Gestión Empresarial', activo: true }),
        this.carreraRepo.create({ clave: 'IL',   nombre: 'Ingeniería en Logística', activo: true }),
      ]);
      this.logger.log('Catálogo de 18 Carreras ITD poblado.');
    }
  }

  private async sembrarEstatusExpediente() {
    if ((await this.estatusExpRepo.count()) === 0) {
      await this.estatusExpRepo.save([
        this.estatusExpRepo.create({ nombre: 'Activo en Archivo Trámite' }),
        this.estatusExpRepo.create({ nombre: 'Transferido a Archivo Concentración' }),
        this.estatusExpRepo.create({ nombre: 'Baja Definitiva' }),
      ]);
      this.logger.log('Catálogo de Estatus de Expediente poblado.');
    }
  }

  private async sembrarEstatusPrestamo() {
    if ((await this.estatusPrestamoRepo.count()) === 0) {
      // Alineado estrictamente a tu máquina de estados en PrestamoService (1=SOLICITADO, 4=EN CUSTODIA, 5=DEVUELTO)
      await this.estatusPrestamoRepo.save([
        this.estatusPrestamoRepo.create({ idEstatusPrestamo: 1, nombre: 'SOLICITADO' }),
        this.estatusPrestamoRepo.create({ idEstatusPrestamo: 2, nombre: 'RECHAZADO' }),
        this.estatusPrestamoRepo.create({ idEstatusPrestamo: 3, nombre: 'VENCIDO' }),
        this.estatusPrestamoRepo.create({ idEstatusPrestamo: 4, nombre: 'EN CUSTODIA' }),
        this.estatusPrestamoRepo.create({ idEstatusPrestamo: 5, nombre: 'DEVUELTO' }),
      ]);
      this.logger.log('Catálogo de Estatus de Préstamo (IDs 1 al 5) poblado.');
    }
  }

  private async sembrarMotivosPrestamo() {
    if ((await this.motivoPrestamoRepo.count()) === 0) {
      await this.motivoPrestamoRepo.save([
        this.motivoPrestamoRepo.create({ nombre: 'Consulta en Ventanilla / Cotejo' }),
        this.motivoPrestamoRepo.create({ nombre: 'Trámite de Titulación' }),
        this.motivoPrestamoRepo.create({ nombre: 'Validación de Servicio Social' }),
        this.motivoPrestamoRepo.create({ nombre: 'Digitalización / Escaneo Forense' }),
        this.motivoPrestamoRepo.create({ nombre: 'Auditoría de Jefatura' }),
      ]);
      this.logger.log('Catálogo de Motivos de Préstamo poblado.');
    }
  }

  private async sembrarEstadosConservacion() {
    if ((await this.conservacionRepo.count()) === 0) {
      await this.conservacionRepo.save([
        this.conservacionRepo.create({ nombre: 'BUENO' }),
        this.conservacionRepo.create({ nombre: 'REGULAR' }),
        this.conservacionRepo.create({ nombre: 'DETERIORADO' }),
        this.conservacionRepo.create({ nombre: 'INCOMPLETO' }),
      ]);
      this.logger.log('Catálogo de Estados de Conservación poblado.');
    }
  }

  private async sembrarTiposArchivo() {
    if ((await this.tipoArchivoRepo.count()) === 0) {
      await this.tipoArchivoRepo.save([
        this.tipoArchivoRepo.create({ nombre: 'Acta de Nacimiento' }),
        this.tipoArchivoRepo.create({ nombre: 'Certificado de Bachillerato' }),
        this.tipoArchivoRepo.create({ nombre: 'Certificado de Licenciatura / Kardex' }),
        this.tipoArchivoRepo.create({ nombre: 'Título Profesional' }),
        this.tipoArchivoRepo.create({ nombre: 'Constancia de Servicio Social' }),
        this.tipoArchivoRepo.create({ nombre: 'Expediente Integral / Otro' }),
      ]);
      this.logger.log('Catálogo de Tipos de Archivo Digital poblado.');
    }
  }
}