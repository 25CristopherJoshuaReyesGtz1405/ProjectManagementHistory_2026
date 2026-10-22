import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../app/app.module.js';
import { describe, it, beforeAll, expect, afterAll, vi } from 'vitest';
import { JwtAuthGuard } from '../AutenticacionActiva/GuardisActivos/JwtAuth.guard.js';

describe('Auditoría de Seguridad: Módulo Archivo Físico (e2e)', () => {
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
    await app.init();
  });

  afterAll(async () => {
    await app.close();
    vi.restoreAllMocks();
  });

  describe('Inspección Forense de Archivos (Anti-Malware / Magic Numbers)', () => {
    it('debe BLOQUEAR un archivo falso que intenta hacerse pasar por PDF (Spoofing)', async () => {
      // 1. Creamos un archivo malicioso en memoria RAM (No es un PDF real)
      const scriptMalicioso = Buffer.from('console.log("Soy un virus"); rm -rf /');
      
      // 2. Simulamos un formulario multipart/form-data enviando este archivo
      const response = await request(app.getHttpServer())
        .post('/api/v3/archivo-fisico/digitalizacion/digitalizar')
        .field('idExpediente', '123e4567-e89b-12d3-a456-426614174000') // UUID válido falso
        .field('idTipoArchivo', 1)
        // El hacker le pone extensión .pdf para engañar al sistema
        .attach('archivo', scriptMalicioso, 'acta_falsa.pdf'); 

      // 3. El Pipe de Magic Numbers DEBE interceptarlo y rechazarlo (400 Bad Request)
      expect(response.status).toBe(400);
      expect(response.body.message).toContain('Alerta de Seguridad');
      expect(response.body.message).toContain('Posible falsificación (Spoofing) detectada');
    });

    it('debe PERMITIR la entrada si el archivo tiene la firma criptográfica real de un PDF', async () => {
      // 1. Creamos un PDF real mínimo en memoria (usando el Magic Number %PDF-1.4)
      const pdfReal = Buffer.from([0x25, 0x50, 0x44, 0x46, 0x2D, 0x31, 0x2E, 0x34, 0x0A, 0x25, 0xE2, 0xE3, 0xCF, 0xD3, 0x0A]);
      
      const response = await request(app.getHttpServer())
        .post('/api/v3/archivo-fisico/digitalizacion/digitalizar')
        .field('idExpediente', '123e4567-e89b-12d3-a456-426614174000') 
        .field('idTipoArchivo', 1)
        .attach('archivo', pdfReal, 'documento_legitimo.pdf');

      // 2. Dependiendo de cómo responda tu base de datos (al no existir el idExpediente falso), 
      // podría dar un 404 (Expediente no encontrado) o un 202 (Encolado).
      // Lo importante es que YA NO es un 400 por falsificación de archivo.
      expect(response.status).not.toBe(400); 
    });
  });
});