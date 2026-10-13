import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../AutenticacionActiva/auth.module.js';
import { APP_GUARD } from '@nestjs/core';
import { JwtAuthGuard } from './../AutenticacionActiva/GuardisActivos/JwtAuth.guard.js';
import { IdentidadModule } from '../IdentidadActiva/IdentidadModule.js';
import { ConfiguracionModule } from '../ConfiguracionActiva/ConfiguracionModule.js';
import { AcademicoModule } from '../Academico/AcademicoModule.js';
import { ArchivoFisicoModule } from '../ArchivoFisico/ArchivoFisicoModule.js';

@Module({
  imports: [
    // 1. Inicializar el módulo de configuración global
    ConfigModule.forRoot({
      isGlobal: true,
    }),

    AuthModule,
    IdentidadModule,
    AcademicoModule,
    ArchivoFisicoModule,
    ConfiguracionModule, 

    
    // 2. Configurar TypeORM de forma asíncrona usando las variables del .env
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get<string>('DB_HOST'),
        port: configService.get<number>('DB_PORT'),
        username: configService.get<string>('DB_USER'),
        password: configService.get<string>('DB_PASSWORD'),
        database: configService.get<string>('DB_NAME'),
        
        // Carga automática de las Entidades que vayamos creando
        autoLoadEntities: true,
        

        synchronize: true, 
        
        // Para ver las consultas SQL en la terminal durante el desarrollo
        logging: true, 
      }),
    }),
  ],
  controllers: [],
  providers: 
  [
    {
      provide: APP_GUARD, 
      useClass: JwtAuthGuard,
    }
  ],
})
export class AppModule {}