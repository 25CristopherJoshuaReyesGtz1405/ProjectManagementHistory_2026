import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, VersionColumn, ManyToOne, JoinColumn, OneToMany, type Relation } from 'typeorm';
import { ExpedienteEntity } from './ExpedienteEntity.js';
import { UsuarioEntity } from '../../IdentidadActiva/Entities/UsuarioEntity.js';
import { FirmaSinodalEntity } from './FirmaSinodalEntity.js';

@Entity({ schema: 'academico', name: 'tramite_titulacion' })
export class TramiteTitulacionEntity {
  @PrimaryGeneratedColumn('uuid', { name: 'id_tramite' })
  idTramite: string;

  @Column({ type: 'varchar', length: 100, name: 'folio', unique: true })
  folio: string;

  @ManyToOne(() => ExpedienteEntity)
  @JoinColumn({ name: 'id_expediente' })
  expediente: Relation<ExpedienteEntity>;

  @ManyToOne(() => UsuarioEntity)
  @JoinColumn({ name: 'id_usuario_solicitante' })
  usuarioSolicitante: Relation<UsuarioEntity>;

  // Máquina de Estados Finita (FSM)
  @Column({ type: 'varchar', length: 50, name: 'estatus_actual' })
  estatusActual: string;

  @Column({ type: 'decimal', precision: 5, scale: 2, name: 'progreso_porcentaje', default: 0 })
  progresoPorcentaje: number;

  @Column({ type: 'boolean', name: 'documentos_validados', default: false })
  documentosValidados: boolean;

  // JSONB para datos dinámicos que no requieren búsquedas inversas (Ej. Pagos y Metadatos)
  @Column({ type: 'jsonb', name: 'pagos_conciliados', nullable: true })
  pagosConciliados: Record<string, any>;

  @Column({ type: 'jsonb', name: 'datos_historicos_sep', nullable: true })
  datosHistoricosSep: Record<string, any>;

  // Relación Inversa para las Firmas del Sínodo
  @OneToMany(() => FirmaSinodalEntity, (firma: FirmaSinodalEntity) => firma.tramite)
  firmasSinodo: Relation<FirmaSinodalEntity[]>;

  // Auditoría y Optimistic Concurrency Control (OCC)
  @CreateDateColumn({ type: 'timestamptz', name: 'fecha_creacion' })
  fechaCreacion: Date;

  @UpdateDateColumn({ type: 'timestamptz', name: 'fecha_actualizacion' })
  fechaActualizacion: Date;

  @VersionColumn({ name: 'version' })
  version: number; // <-- El escudo anti-colisiones de TypeORM
}