import { Injectable } from '@nestjs/common';

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

@Injectable()
export class LruCacheService {
  private readonly cache = new Map<string, CacheEntry<any>>();
  private readonly TTL_MS = 15 * 60 * 1000; // 15 minutos de vida por token

  get<T>(key: string): T | undefined {
    const entry = this.cache.get(key);
    if (!entry) return undefined;

    // Si el tiempo de vida expiró, lo purgamos de la memoria RAM
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return undefined;
    }
    return entry.value;
  }

  set<T>(key: string, value: T): void {
    this.cache.set(key, {
      value,
      expiresAt: Date.now() + this.TTL_MS,
    });
  }

  delete(key: string): void {
    this.cache.delete(key);
  }

  /**
   * Purga toda la caché de identidades en RAM (Uso exclusivo del Administrador)
   */
  clearAll(): number {
    const totalEliminados = this.cache.size;
    this.cache.clear();
    return totalEliminados;
  }

  /**
   * Devuelve métricas del estado actual de la caché LRU en RAM
   */
  obtenerEstadisticasRam() {
    const ahora = Date.now();
    let vigentes = 0;
    let expirados = 0;

    for (const [, entry] of this.cache.entries()) {
      if (ahora <= entry.expiresAt) vigentes++;
      else expirados++;
    }

    return {
      totalLlavesEnRam: this.cache.size,
      sesionesVigentesCache: vigentes,
      sesionesExpiradasPendientes: expirados,
      ttlMinutos: this.TTL_MS / 60000,
    };
  }
}