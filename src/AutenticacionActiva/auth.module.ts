import { Module, Global } from '@nestjs/common';
import { FirebaseConfig } from './ConfiguracionActiva/FirebaseConfig.js';
import { LruCacheService } from './../NucleoActivo/CacheActivo/LruCache.service.js';

@Global()
@Module({
  providers: [FirebaseConfig, LruCacheService],
  exports: [FirebaseConfig, LruCacheService], // Exportamos la configuración y el servicio de caché para que los Guards puedan consumirla
})
export class AuthModule {}