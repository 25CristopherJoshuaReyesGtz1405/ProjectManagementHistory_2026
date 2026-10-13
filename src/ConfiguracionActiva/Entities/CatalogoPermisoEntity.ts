import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity({ schema: 'configuracion', name: 'catalogo_permiso' })
export class CatalogoPermisoEntity {
  @PrimaryGeneratedColumn('increment', { name: 'id_permiso' })
  idPermiso: number;

  @Column({ type: 'varchar', length: 50, name: 'clave' })
  clave: string;

  @Column({ type: 'varchar', length: 255, name: 'descripcion' })
  descripcion: string;
}