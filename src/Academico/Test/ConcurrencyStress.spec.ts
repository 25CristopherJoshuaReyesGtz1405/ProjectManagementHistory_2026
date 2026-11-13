import { Test, TestingModule } from '@nestjs/testing';
import { describe, it, expect, beforeAll, vi } from 'vitest';
import { DataSource } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { InteroperabilidadService } from '../ModuloInteroperabilidad/InteroperabilidadService.js';

describe('Ingeniería de Rendimiento: Prueba de Concurrencia Extrema (Stress Test)', () => {
  let interoperabilidadService: InteroperabilidadService;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InteroperabilidadService,
        { provide: ConfigService, useValue: { get: vi.fn().mockReturnValue('LLAVE_NO_CONFIGURADA') } },
        {
          provide: DataSource,
          useValue: {
            createQueryBuilder: vi.fn().mockReturnValue({
              update: vi.fn().mockReturnThis(),
              set: vi.fn().mockReturnThis(),
              leftJoinAndSelect: vi.fn().mockReturnThis(),
              where: vi.fn().mockReturnThis(),
              andWhere: vi.fn().mockReturnThis(),
              returning: vi.fn().mockReturnThis(),
              execute: vi.fn().mockResolvedValue({
                raw: [{ id_convenio: '1', limite_diario_peticiones: 100, nombre_empresa: 'DGP-SEP' }],
              }),
              getOne: vi.fn().mockResolvedValue({
                numControl: '22040000',
                estatus: { nombre: 'Titulado' },
                nivelAcademico: { nombre: 'Licenciatura' },
                carrera: { nombre: 'Ingeniería en Sistemas Computacionales' },
                titulacion: { tieneTitulo: true },
              }),
            }),
            getRepository: vi.fn().mockReturnValue({ create: vi.fn(), save: vi.fn(), update: vi.fn() }),
          },
        },
      ],
    }).compile();

    interoperabilidadService = module.get<InteroperabilidadService>(InteroperabilidadService);
  });

  it('debe procesar 50 peticiones concurrentes sin colapsar el Event Loop y resolver las 50 firmas', async () => {
    const peticionesMasivas = Array.from({ length: 50 }).map(() =>
      interoperabilidadService.verificarEstatusEgresado('LLAVE_PLANA', '22040000', '192.168.1.100'),
    );

    const resultados = await Promise.allSettled(peticionesMasivas);
    const exitosas = resultados.filter((r) => r.status === 'fulfilled');

    expect(exitosas.length).toBe(50);
  });
});