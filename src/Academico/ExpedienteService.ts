import { Injectable, InternalServerErrorException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CrearExpedienteDTO } from './DTOs/CrearExpedienteDTO.js';
import { ExpedienteEntity } from './Entities/ExpedienteEntity.js';


@Injectable()
export class ExpedienteService {
  constructor(
    @InjectRepository(ExpedienteEntity)
    private readonly expedienteRepo: Repository<ExpedienteEntity>,
  ) {}

  async crearExpediente(dto: CrearExpedienteDTO): Promise<ExpedienteEntity> {
    try {
      // Mapeamos los IDs puros a los objetos relacionales que TypeORM espera
      const nuevoExpediente = this.expedienteRepo.create({
        numControl: dto.numControl,
        persona: { idPersona: dto.idPersona },
        carrera: { idCarrera: dto.idCarrera },
        nivelAcademico: { idNivel: dto.idNivel },
        estatus: { idEstatus: dto.idEstatus },
        folioDigital: dto.folioDigital,
        generacion: dto.generacion,
        modalidad: dto.modalidad,
        titulacion: {} // Detona la creación del checklist (Relación 1:1)
      });

      return await this.expedienteRepo.save(nuevoExpediente);
    } catch (error: any) {
      // 23505 = Unique Violation (Número de control duplicado)
      if (error.code === '23505') {
        throw new ConflictException('El Número de Control ya se encuentra registrado en el acervo.');
      }
      // 23503 = Foreign Key Violation (El ID de persona o catálogo no existe)
      if (error.code === '23503') {
        throw new ConflictException('Inconsistencia referencial: La persona o catálogo indicado no existe en la base de datos.');
      }
      throw new InternalServerErrorException('Fallo crítico al persistir el expediente.');
    }
  }
}