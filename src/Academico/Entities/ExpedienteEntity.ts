import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, DeleteDateColumn, ManyToOne, JoinColumn, OneToOne, type Relation, OneToMany } from 'typeorm';

// Importaciones de dominios transversales (¡Nuestros cimientos!)
import { TitulacionEntity } from './TitulacionEntity.js';
import { CatalogoCarreraEntity } from '../../ConfiguracionActiva/Entities/CatalogoCarreraEntity.js';
import { CatalogoEstatusExpedienteEntity } from '../../ConfiguracionActiva/Entities/CatalogoEstatusExpedienteEntity.js';
import { CatalogoNivelAcademicoEntity } from '../../ConfiguracionActiva/Entities/CatalogoNivelAcademicoEntity.js';
import { PersonaEntity } from '../../IdentidadActiva/Entities/PersonaEntity.js';
import { ArchivoDigitalEntity } from '../../ArchivoFisico/Entities/ArchivoDigitalEntity.js';
import { PrestamoEntity } from '../../ArchivoFisico/Entities/PrestamoEntity.js';
import { UbicacionTopograficaEntity } from '../../ArchivoFisico/Entities/UbicacionTopograficaEntity.js';

@Entity({ schema: 'academico', name: 'expediente' })
export class ExpedienteEntity {
  @PrimaryGeneratedColumn('uuid', { name: 'id_expediente' })
  idExpediente: string;

  @Column({ type: 'varchar', length: 20, name: 'num_control' })
  numControl: string;

  // =========================================================
  // RELACIONES (FOREIGN KEYS)
  // =========================================================

  // Muchos Expedientes pueden pertenecer a Una Persona (Ej. Licenciatura y Maestría)
  @ManyToOne(() => PersonaEntity)
  @JoinColumn({ name: 'id_persona' })
  persona: PersonaEntity;

  @ManyToOne(() => CatalogoCarreraEntity)
  @JoinColumn({ name: 'id_carrera' })
  carrera: CatalogoCarreraEntity;

  @ManyToOne(() => CatalogoNivelAcademicoEntity)
  @JoinColumn({ name: 'id_nivel' })
  nivelAcademico: CatalogoNivelAcademicoEntity;

  @ManyToOne(() => CatalogoEstatusExpedienteEntity)
  @JoinColumn({ name: 'id_estatus' })
  estatus: CatalogoEstatusExpedienteEntity;

  // Relación 1:1 con su checklist de titulación (Cascade permite guardar ambos al mismo tiempo)
  @OneToOne(() => TitulacionEntity, (titulacion) => titulacion.expediente, { cascade: true })
  titulacion: Relation<TitulacionEntity>;

  // =========================================================
  // METADATA DEL EXPEDIENTE
  // =========================================================

  @Column({ type: 'varchar', length: 50, name: 'folio_digital', nullable: true })
  folioDigital: string;

  @Column({ type: 'varchar', length: 20, name: 'generacion', nullable: true })
  generacion: string;

  @Column({ type: 'varchar', length: 20, name: 'modalidad', nullable: true })
  modalidad: string;

  @Column({ type: 'date', name: 'fecha_egreso', nullable: true })
  fechaEgreso: Date;

  // =========================================================
  // AUDITORÍA Y SEGURIDAD ZERO-TRUST
  // =========================================================

  @CreateDateColumn({ type: 'timestamptz', name: 'fecha_creacion' })
  fechaCreacion: Date;

  @UpdateDateColumn({ type: 'timestamptz', name: 'fecha_actualizacion' })
  fechaActualizacion: Date;

  @DeleteDateColumn({ type: 'timestamptz', name: 'fecha_baja', nullable: true })
  fechaBaja: Date;

  // =========================================================
  // RELACIONES INVERSAS (ARCHIVO FÍSICO Y DIGITAL)
  // =========================================================

  // Un expediente solo tiene UNA ubicación topográfica física en el archivo
  @OneToOne(() => UbicacionTopograficaEntity, (ubicacion) => ubicacion.expediente)
  ubicacionFisica: Relation<UbicacionTopograficaEntity>;

  // Un expediente puede tener MUCHOS archivos digitales digitalizados (PDFs, XMLs, etc.)
  @OneToMany(() => ArchivoDigitalEntity, (archivo) => archivo.expediente)
  archivosDigitales: Relation<ArchivoDigitalEntity[]>;

  // Un expediente puede tener un historial de MUCHOS préstamos a lo largo del tiempo
  @OneToMany(() => PrestamoEntity, (prestamo) => prestamo.expediente)
  prestamos: Relation<PrestamoEntity[]>;
}