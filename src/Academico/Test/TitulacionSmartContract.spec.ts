import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException } from '@nestjs/common';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DataSource } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { EstadoTitulacion } from '../Constant/FSM_Titulacion.js';
import { TitulacionService } from '../ModuloTitulacion/TitulacionService.js';

describe('Smart Contract: Acta de Titulación (Unitario)', () => {
  let titulacionService: TitulacionService;
  let mockQueryRunner: any;

  beforeEach(async () => {
    // Mockeamos el QueryRunner transaccional
    mockQueryRunner = {
      connect: vi.fn(),
      startTransaction: vi.fn(),
      commitTransaction: vi.fn(),
      rollbackTransaction: vi.fn(),
      release: vi.fn(),
      manager: {
        createQueryBuilder: vi.fn().mockReturnValue({
          leftJoinAndSelect: vi.fn().mockReturnThis(),
          where: vi.fn().mockReturnThis(),
          setLock: vi.fn().mockReturnThis(),
          // Simulamos que el trámite está listo para firma con 1 firma previa
          getOne: vi.fn().mockResolvedValue({
            idTramite: 'uuid-tramite',
            estatusActual: EstadoTitulacion.PASO_7_FIRMAS_ACTA,
            firmasSinodo: [
              { rolSinodal: 'PRESIDENTE', sinodal: { idUsuario: 'maestro-1' } }
            ]
          })
        }),
        create: vi.fn(),
        save: vi.fn(),
      }
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TitulacionService,
        { provide: DataSource, useValue: { createQueryRunner: () => mockQueryRunner } },
        { provide: ConfigService, useValue: { get: vi.fn().mockReturnValue('TEST_SECRET') } }
      ],
    }).compile();

    titulacionService = module.get<TitulacionService>(TitulacionService);
  });

  it('debe BLOQUEAR a un sinodal si intenta firmar un rol que ya está ocupado', async () => {
    await expect(
      titulacionService.firmarActaExamenSinodal('uuid-tramite', 'PRESIDENTE', '1234', 'maestro-2', '127.0.0.1')
    ).rejects.toThrow(ConflictException);
    
    // Verificamos que se haya hecho Rollback para proteger la BD
    expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalled();
  });

  it('debe BLOQUEAR a un sinodal si intenta firmar dos roles distintos (Usurpación)', async () => {
    await expect(
      // maestro-1 ya firmó como PRESIDENTE, ahora intenta firmar como SECRETARIO
      titulacionService.firmarActaExamenSinodal('uuid-tramite', 'SECRETARIO', '1234', 'maestro-1', '127.0.0.1')
    ).rejects.toThrow(/Un sínodo no puede firmar dos roles/);
  });
});