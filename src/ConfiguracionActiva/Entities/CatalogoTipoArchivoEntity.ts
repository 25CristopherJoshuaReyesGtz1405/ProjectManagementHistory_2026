import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity({ schema: 'configuracion', name: 'catalogo_tipo_archivo' })
export class CatalogoTipoArchivoEntity {
  @PrimaryGeneratedColumn('increment', { name: 'id_tipo_archivo' })
  idTipoArchivo: number;

  @Column({ type: 'varchar', length: 50, name: 'nombre' })
  nombre: string;
}