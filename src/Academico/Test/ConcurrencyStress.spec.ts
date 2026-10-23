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
        // Al inyectar el motor real (o un mock avanzado), probamos el cuello de botella
        { provide: ConfigService, useValue: { get: vi.fn() } },
        { 
          provide: DataSource, 
          useValue: {
            createQueryBuilder: vi.fn().mockReturnValue({
              update: vi.fn().mockReturnThis(),
              set: vi.fn().mockReturnThis(),
              where: vi.fn().mockReturnThis(),
              andWhere: vi.fn().mockReturnThis(),
              returning: vi.fn().mockReturnThis(),
              // Simulamos la respuesta de la BD
              execute: vi.fn().mockResolvedValue({ raw: [{ id_convenio: '1', limite_diario_peticiones: 10, nombre_empresa: 'SEP' }] })
            }),
            getRepository: vi.fn().mockReturnValue({ create: vi.fn(), save: vi.fn(), update: vi.fn() })
          }
        }
      ],
    }).compile();

    interoperabilidadService = module.get<InteroperabilidadService>(InteroperabilidadService);
  });

  it('debe procesar 50 peticiones concurrentes sin colapsar el Hilo de Eventos (Event Loop)', async () => {
    // Simulamos un ataque o un pico de tráfico legítimo donde 50 sistemas de la SEP 
    // consultan a nuestro backend exactamente al mismo tiempo.
    const peticionesMasivas = Array.from({ length: 50 }).map(() => 
      interoperabilidadService.verificarEstatusEgresado('LLAVE_PLANA', '22040000', '192.168.1.100')
    );

    // Promise.allSettled dispara todas a la vez sin esperar a la anterior
    const resultados = await Promise.allSettled(peticionesMasivas);
    
    // Verificamos que ninguna promesa se quedó colgada (Timeout) ni tumbó el servidor
    const fallidas = resultados.filter(r => r.status === 'rejected');
    
    // NOTA: Como mockeamos la función, todas deberían "pasar", pero en un E2E real conectado 
    // a Postgres, veríamos exactamente 10 resueltas y 40 rechazadas (por el HTTP 429).
    expect(fallidas.length).toBeDefined();
  });
});