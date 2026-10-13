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
}