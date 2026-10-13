import { Injectable, CanActivate, ExecutionContext, UnauthorizedException, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { getAuth } from 'firebase-admin/auth';
import { DataSource } from 'typeorm';
import { LruCacheService } from './../../NucleoActivo/CacheActivo/LruCache.service.js';
import { IS_PUBLIC_KEY } from './../DecoradoresActivos/PublicDecorador.js';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly dataSource: DataSource,
    private readonly cacheService: LruCacheService, 
    private readonly reflector: Reflector
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {

    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('Acceso denegado. Bearer Token no proporcionado.');
    }

    const token = authHeader.split('Bearer ')[1];

    try {
      // 1. Verificación matemática contra Google Firebase (Autenticación)
      const decodedToken = await getAuth().verifyIdToken(token);
      const uid = decodedToken.uid;

      // 2. Aceleración por RAM: Buscamos el rol del usuario en la Caché
      let rolUsuario = this.cacheService.get<string>(`user_role_${uid}`);

      // 3. Si no está en RAM (Cold Start), consultamos PostgreSQL (Autorización)
      if (!rolUsuario) {
        // Consulta directa y optimizada a la tabla de identidad
        const result = await this.dataSource.query(
          `SELECT cr.nombre AS rol 
           FROM identidad.usuario u
           INNER JOIN configuracion.catalogo_rol_usuario cr ON u.id_rol = cr.id_rol
           WHERE u.uid_firebase = $1 AND u.fecha_baja IS NULL`,
          [uid]
        );

        if (!result || result.length === 0) {
          throw new ForbiddenException('Su cuenta no tiene privilegios operativos en la base de datos institucional.');
        }

        rolUsuario = result[0].rol;
        
        // Guardamos en RAM para las siguientes peticiones
        this.cacheService.set(`user_role_${uid}`, rolUsuario);
      }

      // 4. Inyectamos los datos en la petición para que los Controladores puedan usarlos
      request.user = {
        uid: uid,
        email: decodedToken.email,
        rol: rolUsuario
      };

      return true;
    } catch (error: any) {
      throw new UnauthorizedException(`Credenciales rechazadas: ${error.message}`);
    }
  }
}