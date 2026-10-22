import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { google, drive_v3 } from 'googleapis';
import * as fs from 'fs';
import { Readable } from 'stream'; 

import { Express } from 'express';
import 'multer';

@Injectable()
export class DriveService {
  private driveClient: drive_v3.Drive;
  private rootFolderId: string;
  private readonly logger = new Logger(DriveService.name);

  constructor(private configService: ConfigService) {
    this.inicializarConexion();
  }

  private inicializarConexion() {
    try {
      const credentialsPath = this.configService.get<string>('GOOGLE_DRIVE_CREDENTIALS_PATH');
      this.rootFolderId = this.configService.get<string>('GOOGLE_DRIVE_ROOT_FOLDER_ID') as any;

      if (!fs.existsSync(credentialsPath as any)) {
        throw new Error(`El archivo de credenciales de Google no existe en la ruta: ${credentialsPath}`);
      }

      // 1. Configuramos la Autenticación como "Cuenta de Servicio" (Robot)
      const auth = new google.auth.GoogleAuth({
        keyFile: credentialsPath,
        scopes: ['https://www.googleapis.com/auth/drive'], // Permiso total sobre el Drive
      });

      // 2. Instanciamos el cliente oficial de Google Drive v3
      this.driveClient = google.drive({ version: 'v3', auth });
      
      this.logger.log('✅ Enlace con Google Drive establecido exitosamente.');
    } catch (error) {
      this.logger.error('❌ Fallo crítico al conectar con Google Drive:', error);
      throw new InternalServerErrorException('No se pudo inicializar la Bóveda Digital en la nube.');
    }
  }

  // ==========================================
  // 🚧 CAMINO 2: CONEXIÓN OAUTH2 (PARA PRODUCCIÓN FUTURA)
  // ==========================================
  /*
  private inicializarConexionOAuth2() {
    try {
      const clientId = process.env.GOOGLE_CLIENT_ID;
      const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
      const redirectUri = 'https://developers.google.com/oauthplayground';
      const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;

      // 1. Instanciamos el cliente OAuth2
      const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);

      // 2. Le inyectamos el Token de Refresco (Acceso infinito a tu cuota personal de 15GB)
      oauth2Client.setCredentials({ refresh_token: refreshToken });

      // 3. Instanciamos Drive con el cliente humano en lugar del Robot
      this.driveClient = google.drive({ version: 'v3', auth: oauth2Client });
      
      this.logger.log('✅ Enlace OAUTH2 con Google Drive establecido exitosamente.');
    } catch (error) {
      this.logger.error('❌ Fallo al inicializar Bóveda Digital OAuth2:', error);
    }
  }
  */

  // Método de diagnóstico para asegurar que el Robot tiene acceso a la carpeta raíz
  async probarConexion(): Promise<boolean> {
    try {
      const response = await this.driveClient.files.get({
        fileId: this.rootFolderId,
        fields: 'id, name',
      });
      this.logger.log(`Radar conectado a Bóveda Raíz: [${response.data.name}]`);
      return true;
    } catch (error) {
      this.logger.error('El Robot no pudo acceder a la carpeta raíz. Verifica los permisos de "Editor" en Drive.', error);
      return false;
    }
  }
  
  /**
   * Busca una carpeta específica por nombre dentro de la Bóveda Raíz. 
   * Si no existe, la crea dinámicamente.
   */
  async obtenerOCrearCarpetaExpediente(nombreCarpeta: string): Promise<string> {
    try {
      // 1. Radar: Buscamos si la carpeta ya existe
      const query = `mimeType='application/vnd.google-apps.folder' and name='${nombreCarpeta}' and '${this.rootFolderId}' in parents and trashed=false`;
      
      const respuestaBusqueda = await this.driveClient.files.list({
        q: query,
        fields: 'files(id, name)',
        spaces: 'drive',
        supportsAllDrives: true, // <-- AÑADIR ESTO
        includeItemsFromAllDrives: true,
      });

      // Si existe, retornamos su ID inmediatamente
      if (respuestaBusqueda.data.files && respuestaBusqueda.data.files.length > 0) {
        return respuestaBusqueda.data.files[0].id as string;
      }

      // 2. Si no existe, la construimos al vuelo
      const metadataCarpeta = {
        name: nombreCarpeta,
        mimeType: 'application/vnd.google-apps.folder',
        parents: [this.rootFolderId],
      };

      const carpetaCreada = await this.driveClient.files.create({
        requestBody: metadataCarpeta,
        fields: 'id',
      });

      this.logger.log(`📁 Nueva sub-bóveda creada en Drive para: ${nombreCarpeta}`);
      return carpetaCreada.data.id as string;

    } catch (error) {
      this.logger.error(`Error al gestionar la carpeta en Drive para ${nombreCarpeta}:`, error);
      throw new InternalServerErrorException('Fallo al estructurar el árbol de directorios en la nube.');
    }
  }

  /**
   * Transmite el archivo físico (Buffer) a la carpeta especificada en Google Drive.
   */
  async subirArchivoDigital(archivo: Express.Multer.File, idCarpetaDestino: string, nombreArchivoFinal: string) {
    try {
      // Convertimos el buffer de memoria en un flujo de datos (Stream) para la API de Google
      const bufferStream = new Readable();
      bufferStream.push(archivo.buffer);
      bufferStream.push(null);

      const metadatosArchivo = {
        name: nombreArchivoFinal,
        parents: [idCarpetaDestino], // Le decimos en qué carpeta guardarlo
      };

      const medios = {
        mimeType: archivo.mimetype,
        body: bufferStream,
      };

      // Ejecutamos la transmisión a la nube
      const archivoSubido = await this.driveClient.files.create({
        requestBody: metadatosArchivo,
        media: medios,
        fields: 'id, webViewLink', // Pedimos que nos devuelva el ID y el enlace para verlo
      });

      const idArchivoSubido = archivoSubido.data.id;
      if (!idArchivoSubido) {
        throw new Error('Google Drive no devolvió el ID del archivo subido.');
      }

      // Opcional pero Enterprise: Le damos permisos de lectura públicos (o del dominio ITD) al archivo
      // para que Angular pueda renderizar el PDF si tiene el enlace directo
      await this.driveClient.permissions.create({
        fileId: idArchivoSubido,
        requestBody: {
          role: 'reader',
          type: 'anyone', // En un entorno real estricto, esto podría limitarse a correos del ITD
        },
      });

      this.logger.log(`📄 Archivo subido exitosamente a Drive: ${nombreArchivoFinal}`);
      
      return {
        idDrive: idArchivoSubido,
        urlVisor: archivoSubido.data.webViewLink
      };

    } catch (error) {
      this.logger.error(`Error crítico al subir el archivo ${nombreArchivoFinal} a Drive:`, error);
      throw new InternalServerErrorException('Fallo en la transmisión del documento a la bóveda en la nube.');
    }
  }

  /**
   * Transmite un archivo físico a Drive utilizando un Stream de disco a red (Máxima eficiencia de RAM)
   */
  async subirArchivoDesdeDisco(rutaFisica: string, mimeType: string, idCarpetaDestino: string, nombreArchivoFinal: string) {
    try {
      const metadatosArchivo = {
        name: nombreArchivoFinal,
        parents: [idCarpetaDestino],
        
      };

      const medios = {
        mimeType: mimeType,
        // Usamos createReadStream para no saturar la memoria del servidor
        body: fs.createReadStream(rutaFisica),
      };

      const archivoSubido = await this.driveClient.files.create({
        requestBody: metadatosArchivo,
        media: medios,
        fields: 'id, webViewLink',
        supportsAllDrives: true, // <-- AÑADIR ESTO
      });

      const idArchivoSubido = archivoSubido.data.id;
      if (!idArchivoSubido) {
        throw new Error('Google Drive no devolvió el ID del archivo subido.');
      }

      // Asignamos permisos para que el SIGAH pueda descargar/visualizar el documento
      await this.driveClient.permissions.create({
        fileId: idArchivoSubido,
        requestBody: { role: 'reader', type: 'anyone' }, // Proxy access
      });

      this.logger.log(`📄 Archivo inyectado en Google Drive: [ID: ${idArchivoSubido}]`);
      
      return {
        idDrive: idArchivoSubido,
        urlVisor: archivoSubido.data.webViewLink
      };

    } catch (error) {
      this.logger.error(`Fallo en la transmisión de red hacia Google Drive:`, error);
      throw new InternalServerErrorException('Error al contactar con la API de Google Storage.');
    }
  }
  
}