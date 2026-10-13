import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, DeleteDateColumn, VersionColumn } from 'typeorm';

@Entity({ schema: 'identidad', name: 'persona' })
export class PersonaEntity {
  @PrimaryGeneratedColumn('uuid', { name: 'id_persona' })
  idPersona: string;

  @Column({ type: 'varchar', length: 18, unique: true, name: 'curp' })
  curp: string;

  @Column({ type: 'varchar', length: 13, unique: true, nullable: true, name: 'rfc' })
  rfc: string;

  @Column({ type: 'varchar', length: 100, name: 'nombre', default: 'N/A' })
  nombre: string;

  @Column({ type: 'varchar', length: 50, name: 'primer_apellido', default: 'N/A' })
  primerApellido: string;

  @Column({ type: 'varchar', length: 50, nullable: true, name: 'segundo_apellido', default: 'N/A' })
  segundoApellido: string;

  @Column({ type: 'char', length: 1, name: 'genero', nullable: true })
 
  // =========================================================
  // METADATA AUTOMÁTICA (Controlada por TypeORM)
  // =========================================================

  @CreateDateColumn({ type: 'timestamp', name: 'fecha_creacion', default: () => 'CURRENT_TIMESTAMP' })
  fechaCreacion: Date;

  @UpdateDateColumn({ type: 'timestamp', name: 'fecha_actualizacion', default: () => 'CURRENT_TIMESTAMP' })
  fechaActualizacion: Date;

  // Zero-Trust: Soft Delete. Debe ser nullable por naturaleza.
  @DeleteDateColumn({ type: 'timestamp', name: 'fecha_baja', nullable: true })
  fechaBaja: Date;

  // Control de Concurrencia Optimista. Le damos un valor por defecto de 1 a los registros heredados.
  @VersionColumn({ name: 'version', default: 1 })
  version: number;
}