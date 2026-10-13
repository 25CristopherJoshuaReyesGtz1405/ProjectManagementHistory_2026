import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, DeleteDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import type { Relation } from 'typeorm';

import { ExpedienteEntity } from '../../Academico/Entities/ExpedienteEntity.js';
import { CatalogoTipoArchivoEntity } from '../../ConfiguracionActiva/Entities/CatalogoTipoArchivoEntity.js';
import { UsuarioEntity } from '../../IdentidadActiva/Entities/UsuarioEntity.js';

@Entity({ schema: 'archivo_fisico', name: 'archivo_digital' })
export class ArchivoDigitalEntity {
  @PrimaryGeneratedColumn('uuid', { name: 'id_archivo' })
  idArchivo: string;

  @ManyToOne(() => ExpedienteEntity)
  @JoinColumn({ name: 'id_expediente' })
  expediente: Relation<ExpedienteEntity>;

  @ManyToOne(() => CatalogoTipoArchivoEntity)
  @JoinColumn({ name: 'id_tipo_archivo' })
  tipoArchivo: Relation<CatalogoTipoArchivoEntity>;

  @ManyToOne(() => UsuarioEntity)
  @JoinColumn({ name: 'id_usuario_subio' })
  usuarioSubio: Relation<UsuarioEntity>;

  @Column({ type: 'varchar', length: 255, name: 'nombre_original' })
  nombreOriginal: string;

  @Column({ type: 'varchar', length: 500, name: 'ruta_local', unique: true })
  rutaLocal: string;

  @Column({ type: 'bigint', name: 'peso_bytes' })
  pesoBytes: string;

  @Column({ type: 'varchar', length: 64, name: 'hash_sha256' })
  hashSha256: string;

  @CreateDateColumn({ type: 'timestamptz', name: 'fecha_creacion' })
  fechaCreacion: Date;

  @DeleteDateColumn({ type: 'timestamptz', name: 'fecha_baja', nullable: true })
  fechaBaja: Date;
}