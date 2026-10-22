import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn, type Relation } from 'typeorm';
import { ExpedienteEntity } from './ExpedienteEntity.js';
import { UsuarioEntity } from '../../IdentidadActiva/Entities/UsuarioEntity.js';

@Entity({ schema: 'academico', name: 'expediente_auditoria' })
export class ExpedienteAuditoriaEntity {
  
  // Llave primaria independiente
  @PrimaryGeneratedColumn('uuid', { name: 'id_auditoria' })
  idAuditoria: string;

  // =========================================================
  // RELACIONES FORENSES
  // =========================================================

  // ¿A qué expediente se le hizo el cambio?
  @ManyToOne(() => ExpedienteEntity)
  @JoinColumn({ name: 'id_expediente' })
  expediente: Relation<ExpedienteEntity>;

  // ¿Qué administrador (Usuario) hizo el cambio? (Zero-Trust)
  @ManyToOne(() => UsuarioEntity)
  @JoinColumn({ name: 'id_usuario_accion' })
  usuarioAccion: Relation<UsuarioEntity>;

  // =========================================================
  // DETALLES DEL EVENTO (Event Sourcing)
  // =========================================================

  // Tipo de acción: 'CREACION', 'ACTUALIZACION_ESTATUS', 'AUDITORIA_CRIPTO', 'CONGELADO'
  @Column({ type: 'varchar', length: 50, name: 'tipo_accion' })
  tipoAccion: string;

  // Un JSON flexible para guardar el "Antes" y "Después" de los datos
  // En PostgreSQL, jsonb es ultra rápido y permite búsquedas internas
  @Column({ type: 'jsonb', name: 'detalles_cambio', nullable: true })
  detallesCambio: Record<string, any>;

  // La IP desde donde se hizo la petición (opcional pero vital en Zero-Trust)
  @Column({ type: 'varchar', length: 45, name: 'ip_origen', nullable: true })
  ipOrigen: string;

  // =========================================================
  // SELLO DE TIEMPO INMUTABLE
  // =========================================================

  // Solo CreateDate, NUNCA UpdateDate ni DeleteDate, porque la historia no se borra ni se edita
  @CreateDateColumn({ type: 'timestamptz', name: 'fecha_accion' })
  fechaAccion: Date;
}