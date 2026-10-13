import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity({ schema: 'configuracion', name: 'catalogo_estado_conservacion' })
export class CatalogoEstadoConservacionEntity {
  @PrimaryGeneratedColumn('increment', { name: 'id_estado' })
  idEstado: number;

  @Column({ type: 'varchar', length: 50, name: 'nombre' })
  nombre: string;
}