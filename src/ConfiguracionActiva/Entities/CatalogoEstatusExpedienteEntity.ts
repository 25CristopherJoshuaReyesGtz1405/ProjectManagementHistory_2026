import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity({ schema: 'configuracion', name: 'catalogo_estatus_expediente' })
export class CatalogoEstatusExpedienteEntity {
  @PrimaryGeneratedColumn('increment', { name: 'id_estatus' })
  idEstatus: number;

  @Column({ type: 'varchar', length: 150, name: 'nombre' })
  nombre: string;
}