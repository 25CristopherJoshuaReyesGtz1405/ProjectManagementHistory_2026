import swaggerJSDoc from 'swagger-jsdoc';

const options: swaggerJSDoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'SIGAH API Documentation',
      version: '1.0.0',
      description: 'Documentación oficial del Sistema de Gestión de Archivo Histórico. Incluye gestión de expedientes, identidades y control de préstamos.',
    },
    servers: [
      {
        url: 'http://localhost:3000',
        description: 'Servidor Local de Desarrollo',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
    },
    security: [
      {
        bearerAuth: [],
      },
    ],
  },
  // ¿Dónde están los archivos con las rutas? Para que Swagger los lea
  apis: ['./src/RoutesActivas/*.ts', './dist/RoutesActivas/*.js'],
};

export const swaggerSpec = swaggerJSDoc(options);