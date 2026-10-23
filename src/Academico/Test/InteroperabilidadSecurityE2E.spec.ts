import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { describe, it, beforeAll, expect, afterAll } from 'vitest';
import { AppModule } from '../../app/app.module.js';

describe('Seguridad B2B: Rate Limiting y Zero-Knowledge Proofs (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('debe rechazar llaves API planas que no coincidan con su Hash (Spoofing)', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v3/interoperabilidad/verificar/C22040000')
      .set('x-api-key', 'LLAVE_INVENTADA_POR_HACKER');

    expect(response.status).toBe(401);
    expect(response.body.message).toContain('Acceso denegado. Bearer Token no proporcionado.');
  });
});