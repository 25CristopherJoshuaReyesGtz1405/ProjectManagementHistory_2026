import { Injectable, CanActivate, ExecutionContext, UnauthorizedException, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { getAuth } from 'firebase-admin/auth';
import { DataSource } from 'typeorm';
import { LruCacheService } from './../../NucleoActivo/CacheActivo/LruCache.service.js';
import { IS_PUBLIC_KEY } from './../DecoradoresActivos/PublicDecorador.js';

interface CachedIdentity {
  idUsuario: string;
  rol: string;
}

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

      // 2. Aceleración por RAM: Buscamos identidad interna y rol en la Caché
      let identidad = this.cacheService.get<CachedIdentity>(`user_identity_${uid}`);

      // 3. Si no está en RAM (Cold Start), consultamos PostgreSQL (Autorización)
      if (!identidad) {
        const result = await this.dataSource.query(
          `SELECT u.id_usuario AS "idUsuario", cr.nombre AS rol 
           FROM identidad.usuario u
           INNER JOIN configuracion.catalogo_rol_usuario cr ON u.id_rol = cr.id_rol
           WHERE u.uid_firebase = $1 AND u.fecha_baja IS NULL`,
          [uid]
        );

        if (!result || result.length === 0) {
          throw new ForbiddenException('Su cuenta no tiene privilegios operativos en la base de datos institucional.');
        }

        identidad = {
          idUsuario: result[0].idUsuario,
          rol: result[0].rol,
        };
        
        // Guardamos en RAM para las siguientes peticiones
        this.cacheService.set(`user_identity_${uid}`, identidad);
      }

      // 4. Inyectamos el UUID real de PostgreSQL junto con el UID de Firebase
      request.user = {
        idUsuario: identidad.idUsuario, // <-- UUID real de PostgreSQL listo para Auditoría Forense
        uid: uid,
        email: decodedToken.email,
        rol: identidad.rol,
      };

      return true;
    } catch (error: any) {
      if (error instanceof ForbiddenException) throw error;
      throw new UnauthorizedException(`Credenciales rechazadas: ${error.message}`);
    }
  }
}