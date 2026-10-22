import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../app/app.module.js';
import { describe, it, beforeAll, expect, afterAll, vi } from 'vitest';
import { JwtAuthGuard } from '../AutenticacionActiva/GuardisActivos/JwtAuth.guard.js';

describe('Auditoría de Seguridad: Módulo de Identidad (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    vi.spyOn(JwtAuthGuard.prototype, 'canActivate').mockImplementation(async (context) => {
      const req = context.switchToHttp().getRequest();
      req.user = { idUsuario: 'uuid-admin-simulado', email: 'auditor@itd.edu.mx', rol: 'Administrador' };
      return true;
    });

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    
    // ENCENDEMOS EL ESCUDO DE VALIDACIÓN GLOBAL EN EL ENTORNO DE PRUEBAS
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );

    await app.init();
  });

  afterAll(async () => {
    await app.close();
    vi.restoreAllMocks();
  });

  describe('Prevención de Inyección SQL y XSS en Datos Personales', () => {
    it('debe rechazar una CURP con inyección SQL (404 Not Found o neutralizado)', async () => {
      const curpMaliciosa = "DROP TABLE identidad.persona; --";
      
      const response = await request(app.getHttpServer())
        .get(`/api/identidad/personas/${encodeURIComponent(curpMaliciosa)}`);

      // El sistema jamás debe arrojar un error 500 (que expone la estructura de la BD)
      // Debe tratarlo como un texto normal que no existe (404)
      expect(response.status).toBe(404);
      expect(JSON.stringify(response.body)).not.toContain('syntax error');
    });

    it('debe bloquear la creación de una persona si la CURP contiene scripts (XSS/Validación DTO)', async () => {
      const payloadXSS = {
        curp: "<script>alert(1)</script>", // Falla la longitud y el Regex del DTO
        nombre: "Hacker",
        primerApellido: "Malicioso"
      };

      const response = await request(app.getHttpServer())
        .post('/api/identidad/personas')
        .send(payloadXSS);

      // El Escudo de Validación Global (ValidationPipe) debe bloquearlo antes de tocar el Controlador
      expect(response.status).toBe(400);
      expect(response.body.message).toBeInstanceOf(Array);
      expect(JSON.stringify(response.body.message)).toContain('El formato de la CURP es inválido');
    });
  });
});