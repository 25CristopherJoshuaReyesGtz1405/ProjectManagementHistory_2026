import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class FirebaseConfig implements OnModuleInit {
  private readonly logger = new Logger('ArquitecturaSeguridad');

  onModuleInit() {
    // Patrón Singleton con la nueva sintaxis modular para entornos ESM
    if (getApps().length === 0) {
      try {
        const serviceAccountPath = path.resolve(process.cwd(), './src/AutenticacionActiva/ConfiguracionActiva/FirebaseServiceAccount.json');
        const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));

        initializeApp({
          credential: cert(serviceAccount),
        });
        
        this.logger.log('🔥 Firebase Admin SDK inicializado (Resource Server Híbrido Activo).');
      } catch (error) {
        this.logger.error('Fallo crítico al inicializar Firebase Admin. Verifique el archivo JSON de credenciales.', error);
        throw error;
      }
    }
  }
}