import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { BadRequestException, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { ExpedienteService } from './ExpedienteService.js';
import { ExpedienteEntity } from '../Entities/ExpedienteEntity.js';
import { CatalogoCarreraEntity } from '../../ConfiguracionActiva/Entities/CatalogoCarreraEntity.js';
import { ExpedienteAuditoriaEntity } from '../Entities/ExpedienteAuditoriaEntity.js';
import { ArchivoDigitalEntity } from '../../ArchivoFisico/Entities/ArchivoDigitalEntity.js';

// 1. IMPORTACIONES NATIVAS DE VITEST
import { describe, it, expect, vi, beforeEach } from 'vitest'; 

describe('ExpedienteService (Unit Tests Enterprise)', () => {
  let service: ExpedienteService;

  // 2. REEMPLAZO DE JEST.FN() POR VI.FN()
  const mockExpedienteRepo = {
    create: vi.fn(),
    save: vi.fn(),
    findOne: vi.fn(),
    createQueryBuilder: vi.fn(),
  };

  const mockCarreraRepo = {
    findOne: vi.fn(),
  };

  const mockAuditoriaRepo = {
    create: vi.fn(),
    save: vi.fn(),
    createQueryBuilder: vi.fn(),
  };

  const mockArchivoDigitalRepo = {
    findOne: vi.fn(),
    save: vi.fn(),
    update: vi.fn(),
  };

  const mockConfigService = {
    get: vi.fn((key: string, defaultVal: string) => defaultVal),
  };

  const mockDataSource = {
    createQueryRunner: vi.fn(),
  };

  beforeEach(async () => {
    // 3. LIMPIEZA DE MOCKS EN VITEST
    vi.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ExpedienteService,
        { provide: getRepositoryToken(ExpedienteEntity), useValue: mockExpedienteRepo },
        { provide: getRepositoryToken(CatalogoCarreraEntity), useValue: mockCarreraRepo },
        { provide: getRepositoryToken(ExpedienteAuditoriaEntity), useValue: mockAuditoriaRepo },
        { provide: getRepositoryToken(ArchivoDigitalEntity), useValue: mockArchivoDigitalRepo },
        { provide: ConfigService, useValue: mockConfigService },
        { provide: DataSource, useValue: mockDataSource },
      ],
    }).compile();

    service = module.get<ExpedienteService>(ExpedienteService);
  });

  it('debe instanciar ExpedienteService con todas sus dependencias IoC', () => {
    expect(service).toBeDefined();
  });

  describe('descargarArchivoTemporal (Seguridad Efímera)', () => {
    it('debe rechazar con UnauthorizedException si el enlace temporal ya expiró', async () => {
      const timestampExpirado = (Date.now() - 60000).toString(); // Expiró hace 1 minuto

      await expect(
        service.descargarArchivoTemporal('uuid-exp', 'uuid-arc', timestampExpirado),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('obtenerDetalleArchivo', () => {
    it('debe lanzar NotFoundException si el documento no existe o está dado de baja', async () => {
      mockArchivoDigitalRepo.findOne.mockResolvedValueOnce(null);

      await expect(
        service.obtenerDetalleArchivo('id-inexistente'),
      ).rejects.toThrow(NotFoundException);
    });

    it('debe retornar los metadatos del archivo cuando está activo', async () => {
      const mockArchivo = {
        idArchivo: 'uuid-123',
        nombreOriginal: 'Acta.pdf',
        rutaLocal: '/boveda/Acta.pdf',
        hashSha256: 'abc123hash',
      };
      mockArchivoDigitalRepo.findOne.mockResolvedValueOnce(mockArchivo);

      const resultado = await service.obtenerDetalleArchivo('uuid-123');
      expect(resultado).toEqual(mockArchivo);
    });
  });

  describe('buscarPorContenidoOCR', () => {
    it('debe bloquear búsquedas menores a 3 caracteres con BadRequestException', async () => {
      await expect(service.buscarPorContenidoOCR('ab')).rejects.toThrow(
        BadRequestException,
      );
    });
  });
});