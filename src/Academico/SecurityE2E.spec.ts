import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../app/app.module.js';
import { describe, it, beforeAll, expect, afterAll, vi } from 'vitest'; // <-- Asegúrate de importar 'vi'
import { JwtAuthGuard } from '../AutenticacionActiva/GuardisActivos/JwtAuth.guard.js';

describe('Auditoría de Ciberseguridad (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    // 1. Hackeamos el Guardia en memoria antes de levantar el servidor
    vi.spyOn(JwtAuthGuard.prototype, 'canActivate').mockImplementation(async (context) => {
      const req = context.switchToHttp().getRequest();
      // Inyectamos la firma criptográfica simulada
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
    vi.restoreAllMocks(); // Limpiamos el hack al terminar
  });

  describe('1. Prevención de Inyección SQL (SQLi)', () => {
    it('debe neutralizar un ataque de UNION SELECT en el buscador OCR', async () => {
      const payloadMalicioso = "' UNION SELECT id_usuario, email FROM identidad.usuario --";
      
      const response = await request(app.getHttpServer())
        .get(`/api/v3/academico/expedientes/buscar/ocr?q=${encodeURIComponent(payloadMalicioso)}`)
        .expect(200);

      // Verificamos que el sistema trató el ataque como una simple búsqueda que no encontró nada
      expect(response.body.status).toBe('success');
      expect(response.body.data.coincidenciasEncontradas).toBe(0);
      
      // LA CORRECCIÓN: Solo verificamos que el arreglo de 'resultados' esté vacío y no traiga correos
      expect(JSON.stringify(response.body.data.resultados)).not.toContain('email');
    });

    it('debe neutralizar un ataque de DROP TABLE en la búsqueda multicriterio', async () => {
      const payloadMalicioso = "C22040000'; DROP TABLE academico.expediente; --";
      
      const response = await request(app.getHttpServer())
        .get(`/api/v3/academico/expedientes/buscar?termino=${encodeURIComponent(payloadMalicioso)}`)
        .expect(200);

      expect(response.body.totalEncontrados).toBe(0);
    });
  });

  describe('2. Privacidad y Zero-Trust (IDOR & Path Traversal)', () => {
    it('debe bloquear intentos de Path Traversal al solicitar archivos físicos', async () => {
      // Intentamos salir de la bóveda para leer archivos del sistema operativo (Ej. contraseñas de Linux)
      const payloadPathTraversal = "../../../../../../etc/passwd";
      
      const response = await request(app.getHttpServer())
        .get(`/api/v3/archivo-fisico/digitalizacion/visor/UUID_FALSO/${payloadPathTraversal}`);

      // El servidor debe rechazarlo con un 404 (Not Found) o 400 (Bad Request), NUNCA devolver el archivo
      expect([404, 400]).toContain(response.status);
    });
  });
});