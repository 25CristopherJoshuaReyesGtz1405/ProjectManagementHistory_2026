import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, DeleteDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import type { Relation } from 'typeorm';
import { CatalogoRolUsuarioEntity } from '../../ConfiguracionActiva/Entities/CatalogoRolUsuarioEntity.js';

// ¡Nota cómo usamos 'ConfiguracionActiva' de acuerdo a tu estructura de carpetas!

@Entity({ schema: 'identidad', name: 'usuario' })
export class UsuarioEntity {
  @PrimaryGeneratedColumn('uuid', { name: 'id_usuario' })
  idUsuario: string;

  @Column({ type: 'varchar', length: 128, name: 'uid_firebase', unique: true })
  uidFirebase: string;

  @Column({ type: 'varchar', length: 150, name: 'email', unique: true })
  email: string;

  @Column({ type: 'varchar', length: 150, name: 'nombre_completo' })
  nombreCompleto: string;

  // Relación con el catálogo de roles
  @ManyToOne(() => CatalogoRolUsuarioEntity)
  @JoinColumn({ name: 'id_rol' })
  rol: Relation<CatalogoRolUsuarioEntity>;

  @Column({ type: 'varchar', length: 150, name: 'departamento', nullable: true })
  departamento: string;

  @Column({ type: 'integer', name: 'trust_score', default: 100 })
  trustScore: number;

  @Column({ type: 'timestamptz', name: 'ultimo_acceso', nullable: true })
  ultimoAcceso: Date;

  @CreateDateColumn({ type: 'timestamptz', name: 'fecha_creacion' })
  fechaCreacion: Date;

  @DeleteDateColumn({ type: 'timestamptz', name: 'fecha_baja', nullable: true })
  fechaBaja: Date;
}