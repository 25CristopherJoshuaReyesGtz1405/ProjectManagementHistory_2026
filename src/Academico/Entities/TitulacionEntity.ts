import { Entity, PrimaryGeneratedColumn, Column, UpdateDateColumn, DeleteDateColumn, OneToOne, JoinColumn, type Relation } from 'typeorm';
import { ExpedienteEntity } from './ExpedienteEntity.js'; 

@Entity({ schema: 'academico', name: 'titulacion' })
export class TitulacionEntity {
  @PrimaryGeneratedColumn('uuid', { name: 'id_titulacion' })
  idTitulacion: string;

  // Relación 1:1 Inversa (Un registro de titulación pertenece a un solo expediente)
  @OneToOne(() => ExpedienteEntity, (expediente) => expediente.titulacion)
  @JoinColumn({ name: 'id_expediente' })
  expediente: Relation<ExpedienteEntity>;

  @Column({ type: 'boolean', name: 'tiene_acta_nacimiento', default: false })
  tieneActaNacimiento: boolean;

  @Column({ type: 'boolean', name: 'tiene_certificado_prepa', default: false })
  tieneCertificadoPrepa: boolean;

  @Column({ type: 'boolean', name: 'tiene_certificado_licenciatura', default: false })
  tieneCertificadoLicenciatura: boolean;

  @Column({ type: 'boolean', name: 'tiene_titulo', default: false })
  tieneTitulo: boolean;

  @Column({ type: 'boolean', name: 'tiene_cedula', default: false })
  tieneCedula: boolean;

  @Column({ type: 'boolean', name: 'ingles_b1', default: false })
  inglesB1: boolean;

  @Column({ type: 'boolean', name: 'actividades_complementarias', default: false })
  actividadesComplementarias: boolean;

  @Column({ type: 'boolean', name: 'servicio_social', default: false })
  servicioSocial: boolean;

  @Column({ type: 'boolean', name: 'residencia_profesional', default: false })
  residenciaProfesional: boolean;

  @Column({ type: 'date', name: 'fecha_titulacion', nullable: true })
  fechaTitulacion: Date;

  // Timestamps de auditoría
  @UpdateDateColumn({ type: 'timestamptz', name: 'fecha_actualizacion' })
  fechaActualizacion: Date;

  @DeleteDateColumn({ type: 'timestamptz', name: 'fecha_baja', nullable: true })
  fechaBaja: Date;
}