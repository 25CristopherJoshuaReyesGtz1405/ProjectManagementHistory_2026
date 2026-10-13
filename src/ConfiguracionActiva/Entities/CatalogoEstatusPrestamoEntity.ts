import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity({ schema: 'configuracion', name: 'catalogo_estatus_prestamo' })
export class CatalogoEstatusPrestamoEntity {
  @PrimaryGeneratedColumn('increment', { name: 'id_estatus_prestamo' })
  idEstatusPrestamo: number;

  @Column({ type: 'varchar', length: 50, name: 'nombre' })
  nombre: string;
}