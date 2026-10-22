import { PipeTransform, Injectable, BadRequestException } from '@nestjs/common';
import { ArchivoDigitalEntity } from '../Entities/ArchivoDigitalEntity.js';

import { Express } from 'express';
import 'multer';

@Injectable()
export class ValidadorFirmaArchivoPipe implements PipeTransform {
  // Límite estricto de 10 MB (en bytes)
  private readonly TAMANO_MAXIMO = 10 * 1024 * 1024; 

  transform(archivo: Express.Multer.File) {
    if (!archivo) {
      throw new BadRequestException('No se detectó ningún archivo en la petición.');
    }

    // 1. Defensa contra Agotamiento de Recursos (Resource Exhaustion)
    if (archivo.size > this.TAMANO_MAXIMO) {
      throw new BadRequestException(`El archivo es demasiado pesado. El límite máximo es 10MB. Tamaño detectado: ${(archivo.size / 1024 / 1024).toFixed(2)}MB`);
    }

    // 2. Inspección Forense Anti-Spoofing (Magic Numbers)
    // Extraemos los primeros 4 bytes del buffer del archivo en formato Hexadecimal
    const firmaHexadecimal = archivo.buffer.toString('hex', 0, 4).toUpperCase();
    
    // Firmas Criptográficas conocidas (Magic Numbers)
    const esPDF = firmaHexadecimal === '25504446'; // %PDF
    const esJPEG = firmaHexadecimal.startsWith('FFD8FF'); // JPEG/JPG
    const esPNG = firmaHexadecimal === '89504E47'; // PNG

    if (!esPDF && !esJPEG && !esPNG) {
      throw new BadRequestException(
        'Alerta de Seguridad: La firma interna del archivo no coincide con un formato válido. Posible falsificación (Spoofing) detectada. Solo se permiten PDFs o imágenes reales.'
      );
    }

    // Si pasó las pruebas, devolvemos el archivo sanitizado al Controller
    return archivo;
  }
}