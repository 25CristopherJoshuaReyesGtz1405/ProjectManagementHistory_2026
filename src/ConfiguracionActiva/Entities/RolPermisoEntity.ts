import { Entity, PrimaryColumn } from 'typeorm';

@Entity({ schema: 'configuracion', name: 'rol_permiso' })
export class RolPermisoEntity {
  @PrimaryColumn({ type: 'integer', name: 'id_rol' })
  idRol: number;

  @PrimaryColumn({ type: 'integer', name: 'id_permiso' })
  idPermiso: number;
}