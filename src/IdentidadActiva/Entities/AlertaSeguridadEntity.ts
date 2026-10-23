import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn, type Relation } from 'typeorm';
import { UsuarioEntity } from './UsuarioEntity.js';

@Entity({ schema: 'identidad', name: 'alerta_seguridad' })
export class AlertaSeguridadEntity {
  @PrimaryGeneratedColumn('uuid', { name: 'id_alerta' })
  idAlerta: string;

  // Puede ser null si el ataque viene de alguien sin iniciar sesión
  @ManyToOne(() => UsuarioEntity, { nullable: true })
  @JoinColumn({ name: 'id_usuario_sospechoso' })
  usuarioSospechoso: Relation<UsuarioEntity>;

  @Column({ type: 'varchar', length: 45, name: 'ip_origen' })
  ipOrigen: string;

  @Column({ type: 'varchar', length: 255, name: 'endpoint_atacado' })
  endpointAtacado: string;

  @Column({ type: 'varchar', length: 50, name: 'tipo_alerta' })
  tipoAlerta: string; // Ej. 'RATE_LIMIT_EXCEDIDO', 'INTENTO_SQLI', 'SPOOFING_ARCHIVO'

  @Column({ type: 'text', name: 'detalles_tecnicos', nullable: true })
  detallesTecnicos: string;

  @CreateDateColumn({ type: 'timestamptz', name: 'fecha_incidente' })
  fechaIncidente: Date;
}