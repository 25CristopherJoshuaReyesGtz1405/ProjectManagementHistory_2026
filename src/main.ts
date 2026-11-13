import { NestFactory } from '@nestjs/core';
import { AppModule } from './app/app.module.js';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const origenesPermitidos = process.env.CORS_ORIGINS
    ? process.env.CORS_ORIGINS.split(',').map((o) => o.trim())
    : ['http://localhost:4200'];

  app.enableCors({
    origin: origenesPermitidos.includes('*') ? true : origenesPermitidos,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
  });

  const port = Number(process.env.PORT) || 3000;
  await app.listen(port, '0.0.0.0');

  // 1. Escudo de Validación Global (Purga Inmunológica)
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // 2. Configuración Enterprise de Swagger
  const config = new DocumentBuilder()
    .setTitle('SIGAH API v3.0')
    .setDescription(
      'Motor Transaccional del Sistema Integral de Gestión de Archivos Históricos',
    )
    .setVersion('3.0')
    .addBearerAuth() // <-- Habilita el botón para inyectar el Token JWT en la UI
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  await app.listen(3000);
  console.log(`🚀 Servidor SIGAH operando en: http://localhost:3000`);
  console.log(`📚 Documentación Swagger en: http://localhost:3000/api/docs`);
}
bootstrap();
