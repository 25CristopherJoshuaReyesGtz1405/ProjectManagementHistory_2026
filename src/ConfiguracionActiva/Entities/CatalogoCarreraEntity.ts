import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity({ schema: 'configuracion', name: 'catalogo_carrera' })
export class CatalogoCarreraEntity {
  // PrimaryGeneratedColumn asume un autoincremental (SERIAL) por defecto para integers
  @PrimaryGeneratedColumn('increment', { name: 'id_carrera' })
  idCarrera: number;

  @Column({ type: 'varchar', length: 20, name: 'clave' })
  clave: string;

  @Column({ type: 'varchar', length: 150, name: 'nombre' })
  nombre: string;

  @Column({ type: 'boolean', name: 'activo', default: true })
  activo: boolean;
}