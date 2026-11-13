import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn
} from 'typeorm';
import { UsuarioEntity } from './UsuarioEntity.js';
import { MensajeSoporteEntity } from './MensajeSoporteEntity.js';

@Entity('tickets_soporte')
export class TicketSoporteEntity {
  @PrimaryGeneratedColumn('uuid', { name: 'id_ticket' })
  idTicket: string;

  @Column({ type: 'varchar', length: 30, unique: true })
  folio: string;

  @Column({ type: 'varchar', length: 40 })
  categoria: 'ESCANER_OCR' | 'PRESTAMOS_OTP' | 'PADRON_EXPEDIENTES' | 'RED_BOVEDA' | 'SUGERENCIA_MEJora';

  @Column({ type: 'varchar', length: 20, default: 'MEDIA' })
  prioridad: 'BAJA' | 'MEDIA' | 'ALTA' | 'URGENTE';

  @Column({ type: 'varchar', length: 180 })
  asunto: string;

  @Column({ type: 'text' })
  descripcion: string;

  @Column({ type: 'varchar', length: 25, default: 'ABIERTO' })
  estado: 'ABIERTO' | 'EN_ATENCION' | 'RESUELTO';

  @Column({ type: 'jsonb', name: 'telemetria_estacion', nullable: true })
  telemetriaEstacion: {
    navegador: string;
    resolucion: string;
    latenciaMs: number;
  };

  @ManyToOne(() => UsuarioEntity, { eager: true })
  @JoinColumn({ name: 'id_usuario_reporta' })
  usuarioReporta: UsuarioEntity;

  @OneToMany(() => MensajeSoporteEntity, (mensaje) => mensaje.ticket, { cascade: true })
  mensajes: MensajeSoporteEntity[];

  @CreateDateColumn({ name: 'fecha_creacion' })
  fechaCreacion: Date;

  @UpdateDateColumn({ name: 'fecha_actualizacion' })
  fechaActualizacion: Date;
}