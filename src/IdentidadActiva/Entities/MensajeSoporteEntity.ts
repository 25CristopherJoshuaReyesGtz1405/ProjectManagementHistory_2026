import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn
} from 'typeorm';
import { TicketSoporteEntity } from './TicketSoporteEntity.js';
import { UsuarioEntity } from './UsuarioEntity.js';

@Entity('mensajes_soporte')
export class MensajeSoporteEntity {
  @PrimaryGeneratedColumn('uuid', { name: 'id_mensaje' })
  idMensaje: string;

  @Column({ type: 'varchar', length: 25 })
  autor: 'OPERADOR' | 'ADMIN_SISTEMA';

  @Column({ type: 'varchar', length: 120, name: 'nombre_autor' })
  nombreAutor: string;

  @Column({ type: 'text' })
  texto: string;

  @ManyToOne(() => TicketSoporteEntity, (ticket) => ticket.mensajes, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'id_ticket' })
  ticket: TicketSoporteEntity | null;

  @ManyToOne(() => UsuarioEntity, { nullable: true })
  @JoinColumn({ name: 'id_usuario_emisor' })
  usuarioEmisor: UsuarioEntity;

  @CreateDateColumn({ name: 'fecha_envio' })
  fecha: Date;
}