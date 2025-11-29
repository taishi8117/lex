import type { DictionaryResult } from '@/providers/types';
import { CACHE_CONFIG } from '@/shared/constants';

interface CacheEntry {
  data: DictionaryResult;
  timestamp: number;
  source: string;
  ttl: number;
}

/**
 * Simple LRU cache implementation for memory caching.
 */
class LRUCache<K, V> {
  private cache = new Map<K, V>();
  private maxSize: number;

  constructor(maxSize: number) {
    this.maxSize = maxSize;
  }

  get(key: K): V | undefined {
    const value = this.cache.get(key);
    if (value !== undefined) {
      // Move to end (most recently used)
      this.cache.delete(key);
      this.cache.set(key, value);
    }
    return value;
  }

  set(key: K, value: V): void {
    // Delete existing to move to end
    if (this.cache.has(key)) {
      this.cache.delete(key);
    }
    // Evict oldest if at capacity
    else if (this.cache.size >= this.maxSize) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey !== undefined) {
        this.cache.delete(oldestKey);
      }
    }
    this.cache.set(key, value);
  }

  delete(key: K): boolean {
    return this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }

  get size(): number {
    return this.cache.size;
  }
}

/**
 * Three-tier caching service:
 * L1: Memory (LRU cache) - instant access
 * L2: Session storage - persists per tab
 * L3: Chrome storage - persistent across sessions
 */
class CacheServiceImpl {
  private memoryCache = new LRUCache<string, CacheEntry>(CACHE_CONFIG.MEMORY_MAX_ENTRIES);

  /**
   * Get cached result for a word from a specific source.
   */
  async get(word: string, source: string): Promise<DictionaryResult | null> {
    const key = this.createKey(word, source);

    // L1: Memory cache
    const memoryHit = this.memoryCache.get(key);
    if (memoryHit && !this.isExpired(memoryHit)) {
      return memoryHit.data;
    }

    // L2: Session storage
    try {
      const sessionHit = sessionStorage.getItem(key);
      if (sessionHit) {
        const parsed = JSON.parse(sessionHit) as CacheEntry;
        if (!this.isExpired(parsed)) {
          // Promote to L1
          this.memoryCache.set(key, parsed);
          return parsed.data;
        }
        // Clean up expired entry
        sessionStorage.removeItem(key);
      }
    } catch {
      // Session storage may not be available in some contexts
    }

    // L3: Chrome storage
    try {
      const result = await chrome.storage.local.get(key);
      const stored = result[key] as CacheEntry | undefined;
      if (stored && !this.isExpired(stored)) {
        // Promote to L1 and L2
        this.memoryCache.set(key, stored);
        try {
          sessionStorage.setItem(key, JSON.stringify(stored));
        } catch {
          // Ignore session storage errors
        }
        return stored.data;
      }
      // Clean up expired entry
      if (stored) {
        await chrome.storage.local.remove(key);
      }
    } catch {
      // Chrome storage may not be available
    }

    return null;
  }

  /**
   * Store a result in all cache tiers.
   */
  async set(word: string, source: string, data: DictionaryResult): Promise<void> {
    const key = this.createKey(word, source);
    const ttl = source === 'openai' ? CACHE_CONFIG.OPENAI_TTL_MS : CACHE_CONFIG.DEFAULT_TTL_MS;

    const entry: CacheEntry = {
      data,
      timestamp: Date.now(),
      source,
      ttl,
    };

    // L1: Memory cache (synchronous)
    this.memoryCache.set(key, entry);

    // L2: Session storage
    try {
      sessionStorage.setItem(key, JSON.stringify(entry));
    } catch {
      // Ignore session storage errors (quota exceeded, etc.)
    }

    // L3: Chrome storage (async)
    try {
      await chrome.storage.local.set({ [key]: entry });
    } catch {
      // Ignore chrome storage errors
    }
  }

  /**
   * Remove a specific entry from all cache tiers.
   */
  async remove(word: string, source: string): Promise<void> {
    const key = this.createKey(word, source);

    this.memoryCache.delete(key);

    try {
      sessionStorage.removeItem(key);
    } catch {
      // Ignore
    }

    try {
      await chrome.storage.local.remove(key);
    } catch {
      // Ignore
    }
  }

  /**
   * Clear all cached data.
   */
  async clear(): Promise<void> {
    this.memoryCache.clear();

    // Clear session storage (only our keys)
    try {
      const keysToRemove: string[] = [];
      for (let i = 0; i < sessionStorage.length; i++) {
        const key = sessionStorage.key(i);
        if (key?.startsWith(CACHE_CONFIG.SESSION_KEY_PREFIX)) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach((key) => sessionStorage.removeItem(key));
    } catch {
      // Ignore
    }

    // Clear chrome storage (only our cache keys)
    try {
      const result = await chrome.storage.local.get(null);
      const keysToRemove = Object.keys(result).filter((key) =>
        key.startsWith(CACHE_CONFIG.STORAGE_KEY_PREFIX)
      );
      if (keysToRemove.length > 0) {
        await chrome.storage.local.remove(keysToRemove);
      }
    } catch {
      // Ignore
    }
  }

  /**
   * Get cache statistics.
   */
  getStats(): { memorySize: number } {
    return {
      memorySize: this.memoryCache.size,
    };
  }

  private createKey(word: string, source: string): string {
    return `${CACHE_CONFIG.STORAGE_KEY_PREFIX}${source}:${word.toLowerCase()}`;
  }

  private isExpired(entry: CacheEntry): boolean {
    return Date.now() - entry.timestamp > entry.ttl;
  }
}

export const cacheService = new CacheServiceImpl();
