import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn, type Relation } from 'typeorm';
import { TramiteTitulacionEntity } from './TramiteTitulacionEntity.js';
import { UsuarioEntity } from '../../IdentidadActiva/Entities/UsuarioEntity.js';
import { CatalogoSinodalEntity } from './CatalogoSinodalEntity.js';

@Entity({ schema: 'academico', name: 'firma_sinodal' })
export class FirmaSinodalEntity {
  @PrimaryGeneratedColumn('uuid', { name: 'id_firma' })
  idFirma: string;

  @ManyToOne(() => TramiteTitulacionEntity, tramite => tramite.firmasSinodo)
  @JoinColumn({ name: 'id_tramite' })
  tramite: Relation<TramiteTitulacionEntity>;

  @ManyToOne(() => CatalogoSinodalEntity)
  @JoinColumn({ name: 'id_usuario_sinodal' })
  sinodal: Relation<CatalogoSinodalEntity>;

  @Column({ type: 'varchar', length: 20, name: 'rol_sinodal' })
  rolSinodal: string; // PRESIDENTE, SECRETARIO, VOCAL

  @Column({ type: 'varchar', length: 255, name: 'sello_criptografico', unique: true })
  selloCriptografico: string;

  @Column({ type: 'varchar', length: 45, name: 'ip_origen' })
  ipOrigen: string;

  @CreateDateColumn({ type: 'timestamptz', name: 'fecha_firma' })
  fechaFirma: Date;
}