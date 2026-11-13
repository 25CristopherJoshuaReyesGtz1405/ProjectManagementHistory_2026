import { describe, it, expect, beforeEach } from 'vitest';
import { BadRequestException } from '@nestjs/common';
import { ValidadorFirmaArchivoPipe } from './ValidadorFirmaArchivoPipe.js';
import { LruCacheService } from '../../NucleoActivo/CacheActivo/LruCache.service.js';

describe('Seguridad Perimetral: ValidadorFirmaArchivoPipe & LruCacheService', () => {
  let pipe: ValidadorFirmaArchivoPipe;
  let cache: LruCacheService;

  beforeEach(() => {
    pipe = new ValidadorFirmaArchivoPipe();
    cache = new LruCacheService();
  });

  it('debe aceptar un buffer con Magic Number de PDF real (%PDF / 25504446)', () => {
    const fakePdfFile: any = {
      size: 1024,
      buffer: Buffer.from([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34]),
    };
    expect(pipe.transform(fakePdfFile)).toEqual(fakePdfFile);
  });

  it('debe rechazar con BadRequestException un ejecutable o script renombrado a .pdf', () => {
    const spoofedFile: any = {
      size: 512,
      buffer: Buffer.from('MZ_malware_executable_payload'),
    };
    expect(() => pipe.transform(spoofedFile)).toThrow(BadRequestException);
  });

  it('debe almacenar, recuperar y purgar identidades en LruCacheService', () => {
    cache.set('user_identity_uid123', { idUsuario: 'uuid-1', rol: 'ADMIN' });
    expect(cache.get('user_identity_uid123')).toEqual({ idUsuario: 'uuid-1', rol: 'ADMIN' });

    const eliminados = cache.clearAll();
    expect(eliminados).toBe(1);
    expect(cache.get('user_identity_uid123')).toBeUndefined();
  });
});