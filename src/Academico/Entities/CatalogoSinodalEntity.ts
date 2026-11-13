import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn
} from 'typeorm';

@Entity({schema: 'configuracion', name: 'catalogo_sinodales_itd'})
export class CatalogoSinodalEntity {
  @PrimaryGeneratedColumn('uuid')
  idSinodal!: string;

  @Column({ type: 'varchar', length: 30, default: 'M.C.' })
  gradoAcademico!: string;

  @Column({ type: 'varchar', length: 160 })
  nombreCompleto!: string;

  @Column({ type: 'varchar', length: 120, default: 'Sistemas y Computación' })
  departamento!: string;

  @Column({ type: 'varchar', length: 40, nullable: true })
  claveEmpleado?: string;

  @Column({ type: 'boolean', default: true })
  activo!: boolean;

  @CreateDateColumn()
  fechaRegistro!: Date;
}