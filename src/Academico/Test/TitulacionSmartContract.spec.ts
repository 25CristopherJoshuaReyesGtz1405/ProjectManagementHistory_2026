import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException } from '@nestjs/common';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DataSource } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { getRepositoryToken } from '@nestjs/typeorm';
import { EstadoTitulacion } from '../Constant/FSM_Titulacion.js';
import { TitulacionService } from '../ModuloTitulacion/TitulacionService.js';
import { CatalogoSinodalEntity } from '../Entities/CatalogoSinodalEntity.js';

describe('Smart Contract: Acta de Titulación (Unitario)', () => {
  let titulacionService: TitulacionService;
  let mockQueryRunner: any;

  const UUID_MAESTRO_1 = '11111111-1111-4111-8111-111111111111';
  const UUID_MAESTRO_2 = '22222222-2222-4222-8222-222222222222';

  beforeEach(async () => {
    mockQueryRunner = {
      connect: vi.fn(),
      startTransaction: vi.fn(),
      commitTransaction: vi.fn(),
      rollbackTransaction: vi.fn(),
      release: vi.fn(),
      manager: {
        findOne: vi.fn().mockImplementation((_entity, opts) => {
          return Promise.resolve({
            idSinodal: opts.where.idSinodal,
            nombreCompleto: 'Sinodal de Prueba',
          });
        }),
        createQueryBuilder: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnThis(),
          leftJoinAndSelect: vi.fn().mockReturnThis(),
          where: vi.fn().mockReturnThis(),
          setLock: vi.fn().mockReturnThis(),
          getOne: vi.fn().mockResolvedValue({
            idTramite: 'uuid-tramite',
            estatusActual: EstadoTitulacion.PASO_7_FIRMAS_ACTA,
            firmasSinodo: [
              { rolSinodal: 'PRESIDENTE', sinodal: { idSinodal: UUID_MAESTRO_1 } },
            ],
          }),
        }),
        create: vi.fn(),
        save: vi.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TitulacionService,
        { provide: DataSource, useValue: { createQueryRunner: () => mockQueryRunner } },
        { provide: ConfigService, useValue: { get: vi.fn().mockReturnValue('TEST_SECRET') } },
        { provide: getRepositoryToken(CatalogoSinodalEntity), useValue: { count: vi.fn().mockResolvedValue(6) } },
      ],
    }).compile();

    titulacionService = module.get<TitulacionService>(TitulacionService);
  });

  it('debe BLOQUEAR a un sinodal si intenta firmar un rol que ya está ocupado', async () => {
    await expect(
      titulacionService.firmarActaExamenSinodal('uuid-tramite', 'PRESIDENTE', '1234', UUID_MAESTRO_2, 'Defecto', '127.0.0.1'),
    ).rejects.toThrow(ConflictException);

    expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalled();
  });

  it('debe BLOQUEAR a un sinodal si intenta firmar dos roles distintos (Usurpación)', async () => {
    await expect(
      titulacionService.firmarActaExamenSinodal('uuid-tramite', 'SECRETARIO', '1234', UUID_MAESTRO_1, 'Defecto', '127.0.0.1'),
    ).rejects.toThrow(/Un sínodo no puede firmar dos roles/);
  });
});