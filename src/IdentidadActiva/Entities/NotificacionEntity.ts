import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn, type Relation } from 'typeorm';
import { UsuarioEntity } from './UsuarioEntity.js';

@Entity({ schema: 'identidad', name: 'notificacion_usuario' })
export class NotificacionEntity {
  @PrimaryGeneratedColumn('uuid', { name: 'id_notificacion' })
  idNotificacion: string;

  @ManyToOne(() => UsuarioEntity)
  @JoinColumn({ name: 'id_usuario_destino' })
  usuarioDestino: Relation<UsuarioEntity>;

  @Column({ type: 'varchar', length: 150, name: 'titulo' })
  titulo: string;

  @Column({ type: 'text', name: 'mensaje' })
  mensaje: string;

  @Column({ type: 'varchar', length: 50, name: 'tipo_alerta' })
  tipoAlerta: string; // Ej. 'PRESTAMO_PENDIENTE_OTP', 'SISTEMA', 'NUEVO_TRAMITE'

  @Column({ type: 'jsonb', name: 'metadata_enlace', nullable: true })
  metadataEnlace: Record<string, any>; // Para que al dar clic en la campana, Angular sepa a qué ID redirigir

  @Column({ type: 'boolean', name: 'leida', default: false })
  leida: boolean;

  @CreateDateColumn({ type: 'timestamptz', name: 'fecha_emision' })
  fechaEmision: Date;
}