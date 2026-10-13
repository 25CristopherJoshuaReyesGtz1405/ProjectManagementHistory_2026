import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity({ schema: 'configuracion', name: 'catalogo_motivo_prestamo' })
export class CatalogoMotivoPrestamoEntity {
  @PrimaryGeneratedColumn('increment', { name: 'id_motivo' })
  idMotivo: number;

  @Column({ type: 'varchar', length: 100, name: 'nombre' })
  nombre: string;
}