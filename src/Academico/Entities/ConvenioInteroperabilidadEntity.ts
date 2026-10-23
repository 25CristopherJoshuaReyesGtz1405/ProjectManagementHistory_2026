import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity({ schema: 'academico', name: 'convenio_interoperabilidad' })
export class ConvenioInteroperabilidadEntity {
  @PrimaryGeneratedColumn('uuid', { name: 'id_convenio' })
  idConvenio: string;

  @Column({ type: 'varchar', length: 150, name: 'nombre_empresa' })
  nombreEmpresa: string;

  @Column({ type: 'varchar', length: 100, name: 'folio_oficio_legal', unique: true })
  folioOficioLegal: string;

  // Zero-Trust: Guardamos el HASH de la llave, JAMÁS la llave plana
  @Column({ type: 'varchar', length: 255, name: 'api_key_hash', unique: true })
  apiKeyHash: string;

  @Column({ type: 'int', name: 'limite_diario_peticiones', default: 100 })
  limiteDiarioPeticiones: number;

  @Column({ type: 'boolean', name: 'activo', default: true })
  activo: boolean;

  @Column({ type: 'text', name: 'motivo_bloqueo', nullable: true })
  motivoBloqueo: string;

  @Column({ type: 'timestamptz', name: 'fecha_vencimiento' })
  fechaVencimiento: Date;

  @CreateDateColumn({ type: 'timestamptz', name: 'fecha_creacion' })
  fechaCreacion: Date;

  @UpdateDateColumn({ type: 'timestamptz', name: 'fecha_actualizacion' })
  fechaActualizacion: Date;
}