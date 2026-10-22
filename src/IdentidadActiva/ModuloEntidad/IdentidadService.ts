import { Injectable, ConflictException, NotFoundException, InternalServerErrorException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ActualizarPersonaDTO } from '../DTOs/ActualizarPersonaDTO.js';
import { CrearPersonaDTO } from '../DTOs/CrearPersonaDTO.js';
import { PersonaEntity } from '../Entities/PersonaEntity.js';


@Injectable()
export class IdentidadService {
  constructor(
    @InjectRepository(PersonaEntity)
    private readonly personaRepository: Repository<PersonaEntity>,
  ) {}

  async crearPersona(datos: CrearPersonaDTO): Promise<PersonaEntity> {
    try {
      const nuevaPersona = this.personaRepository.create(datos);
      return await this.personaRepository.save(nuevaPersona);
    } catch (error: any) {
      // Código de error de PostgreSQL para "Unique Violation"
      if (error.code === '23505') {
        throw new ConflictException('Inconsistencia: La CURP o RFC ya se encuentra registrada en el padrón.');
      }
      throw new InternalServerErrorException('Fallo al persistir la identidad en la base de datos.');
    }
  }

  async obtenerTodas(): Promise<PersonaEntity[]> {
    return await this.personaRepository.find();
  }

  async obtenerPorCurp(curp: string): Promise<PersonaEntity> {
    const persona = await this.personaRepository.findOne({ where: { curp } });
    if (!persona) {
      throw new NotFoundException(`La identidad con CURP ${curp} no fue localizada.`);
    }
    return persona;
  }

  async actualizarPersona(curp: string, cambios: ActualizarPersonaDTO): Promise<PersonaEntity> {
    const persona = await this.obtenerPorCurp(curp);
    
    // TypeORM fusiona los cambios automáticamente
    this.personaRepository.merge(persona, cambios);
    
    try {
      return await this.personaRepository.save(persona);
    } catch (error: any) {
      if (error.code === '23505') throw new ConflictException('Conflicto: El nuevo RFC o CURP ya está en uso.');
      throw new InternalServerErrorException('Fallo al actualizar la identidad.');
    }
  }

  async bajaLogica(curp: string): Promise<void> {
    const persona = await this.obtenerPorCurp(curp);
    // Ejecuta el Soft-Delete inyectando la fecha actual en "fecha_baja"
    await this.personaRepository.softRemove(persona); 
  }
}