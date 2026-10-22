import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, DeleteDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import type { Relation } from 'typeorm';


import { ExpedienteEntity } from '../../Academico/Entities/ExpedienteEntity.js';
import { CatalogoEstadoConservacionEntity } from '../../ConfiguracionActiva/Entities/CatalogoEstadoConservacionEntity.js';
import { CatalogoEstatusPrestamoEntity } from '../../ConfiguracionActiva/Entities/CatalogoEstatusPrestamoEntity.js';
import { CatalogoMotivoPrestamoEntity } from '../../ConfiguracionActiva/Entities/CatalogoMotivoPrestamoEntity.js';
import { UsuarioEntity } from '../../IdentidadActiva/Entities/UsuarioEntity.js';


@Entity({ schema: 'archivo_fisico', name: 'prestamo' })
export class PrestamoEntity {
  @PrimaryGeneratedColumn('uuid', { name: 'id_prestamo' })
  idPrestamo: string;

  @Column({ type: 'varchar', length: 100, name: 'folio', unique: true })
  folio: string;

  // ================= RELACIONES =================
  @ManyToOne(() => ExpedienteEntity)
  @JoinColumn({ name: 'id_expediente' })
  expediente: Relation<ExpedienteEntity>;

  @ManyToOne(() => UsuarioEntity)
  @JoinColumn({ name: 'id_usuario_solicitante' })
  usuarioSolicitante: Relation<UsuarioEntity>;

  @ManyToOne(() => UsuarioEntity)
  @JoinColumn({ name: 'id_usuario_autoriza' })
  usuarioAutoriza: Relation<UsuarioEntity>;

  @ManyToOne(() => CatalogoMotivoPrestamoEntity)
  @JoinColumn({ name: 'id_motivo' })
  motivo: Relation<CatalogoMotivoPrestamoEntity>;

  @ManyToOne(() => CatalogoEstatusPrestamoEntity)
  @JoinColumn({ name: 'id_estatus_prestamo' })
  estatusPrestamo: Relation<CatalogoEstatusPrestamoEntity>;

  @ManyToOne(() => CatalogoEstadoConservacionEntity)
  @JoinColumn({ name: 'id_estado_conservacion_retorno' })
  estadoConservacionRetorno: Relation<CatalogoEstadoConservacionEntity>;

  // ================= TIEMPOS Y OBSERVACIONES =================
  @Column({ type: 'timestamptz', name: 'fecha_salida', nullable: true })
  fechaSalida: Date;

  @Column({ type: 'timestamptz', name: 'fecha_vencimiento', nullable: true })
  fechaVencimiento: Date;

  @Column({ type: 'timestamptz', name: 'fecha_retorno', nullable: true })
  fechaRetorno: Date;

  @Column({ type: 'text', name: 'observaciones_salida', nullable: true })
  observacionesSalida: string;

  @Column({ type: 'text', name: 'observaciones_retorno', nullable: true })
  observacionesRetorno: string;

  // ================= ZERO-TRUST MFA =================
  @Column({ type: 'varchar', length: 255, name: 'otp_hashed', nullable: true })
  otpHashed: string | null;

  @Column({ type: 'timestamptz', name: 'otp_expiracion', nullable: true })
  otpExpiracion: Date | null;

  // ================= AUDITORÍA =================
  @CreateDateColumn({ type: 'timestamptz', name: 'fecha_creacion' })
  fechaCreacion: Date;

  @UpdateDateColumn({ type: 'timestamptz', name: 'fecha_actualizacion' })
  fechaActualizacion: Date;

  @DeleteDateColumn({ type: 'timestamptz', name: 'fecha_baja', nullable: true })
  fechaBaja: Date;
}