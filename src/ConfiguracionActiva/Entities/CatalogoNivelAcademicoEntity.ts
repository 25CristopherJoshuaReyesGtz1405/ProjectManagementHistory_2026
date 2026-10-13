import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity({ schema: 'configuracion', name: 'catalogo_nivel_academico' })
export class CatalogoNivelAcademicoEntity {
  @PrimaryGeneratedColumn('increment', { name: 'id_nivel' })
  idNivel: number;

  @Column({ type: 'varchar', length: 50, name: 'nombre' })
  nombre: string;
}