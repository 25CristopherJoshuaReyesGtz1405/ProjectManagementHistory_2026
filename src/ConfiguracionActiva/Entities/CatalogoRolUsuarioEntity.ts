import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity({ schema: 'configuracion', name: 'catalogo_rol_usuario' })
export class CatalogoRolUsuarioEntity {
  @PrimaryGeneratedColumn('increment', { name: 'id_rol' })
  idRol: number;

  @Column({ type: 'varchar', length: 50, name: 'nombre' })
  nombre: string;
}