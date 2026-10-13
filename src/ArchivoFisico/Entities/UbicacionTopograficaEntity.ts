import { Entity, PrimaryGeneratedColumn, Column, UpdateDateColumn, DeleteDateColumn, OneToOne, JoinColumn, ManyToOne } from 'typeorm';
import type { Relation } from 'typeorm';

import { ExpedienteEntity } from '../../Academico/Entities/ExpedienteEntity.js';
import { CatalogoEstadoConservacionEntity } from '../../ConfiguracionActiva/Entities/CatalogoEstadoConservacionEntity.js';

@Entity({ schema: 'archivo_fisico', name: 'ubicacion_topografica' })
export class UbicacionTopograficaEntity {
  @PrimaryGeneratedColumn('uuid', { name: 'id_ubicacion' })
  idUbicacion: string;

  // Relación 1:1 (Un expediente solo puede estar en un lugar a la vez)
  @OneToOne(() => ExpedienteEntity)
  @JoinColumn({ name: 'id_expediente' })
  expediente: Relation<ExpedienteEntity>;

  @Column({ type: 'varchar', length: 50, name: 'edificio', nullable: true })
  edificio: string;

  @Column({ type: 'varchar', length: 50, name: 'estante', nullable: true })
  estante: string;

  @Column({ type: 'varchar', length: 50, name: 'caja', nullable: true })
  caja: string;

  @Column({ type: 'varchar', length: 50, name: 'carpeta', nullable: true })
  carpeta: string;

  @ManyToOne(() => CatalogoEstadoConservacionEntity)
  @JoinColumn({ name: 'id_estado_conservacion' })
  estadoConservacion: Relation<CatalogoEstadoConservacionEntity>;

  @Column({ type: 'text', name: 'observaciones_fisicas', nullable: true })
  observacionesFisicas: string;

  @UpdateDateColumn({ type: 'timestamptz', name: 'fecha_actualizacion' })
  fechaActualizacion: Date;

  @DeleteDateColumn({ type: 'timestamptz', name: 'fecha_baja', nullable: true })
  fechaBaja: Date;
}