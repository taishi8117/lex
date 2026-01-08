/**
 * Storage adapter interface for cross-platform storage abstraction.
 * Chrome uses chrome.storage.local, Safari uses browser.storage.local.
 */
export interface StorageAdapter {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T): Promise<void>;
  remove(key: string): Promise<void>;
  getAll(): Promise<Record<string, unknown>>;
  removeMany(keys: string[]): Promise<void>;
}

/**
 * Chrome storage adapter using chrome.storage.local.
 * Used for Chrome, Edge, and other Chromium-based browsers.
 */
class ChromeStorageAdapter implements StorageAdapter {
  async get<T>(key: string): Promise<T | null> {
    try {
      const result = await chrome.storage.local.get(key);
      return (result[key] as T) ?? null;
    } catch {
      return null;
    }
  }

  async set<T>(key: string, value: T): Promise<void> {
    await chrome.storage.local.set({ [key]: value });
  }

  async remove(key: string): Promise<void> {
    await chrome.storage.local.remove(key);
  }

  async getAll(): Promise<Record<string, unknown>> {
    try {
      return await chrome.storage.local.get(null);
    } catch {
      return {};
    }
  }

  async removeMany(keys: string[]): Promise<void> {
    if (keys.length > 0) {
      await chrome.storage.local.remove(keys);
    }
  }
}

/**
 * Safari storage adapter using browser.storage.local.
 * Handles the ~50KB storage limit on iOS Safari.
 */
class SafariStorageAdapter implements StorageAdapter {
  private static readonly MAX_STORAGE_SIZE = 50 * 1024; // 50KB limit
  private static readonly CRITICAL_KEYS = ['lex_settings', 'lex_provider_settings'];

  async get<T>(key: string): Promise<T | null> {
    try {
      // Safari uses the browser.* namespace (WebExtensions standard)
      const result = await (globalThis as typeof globalThis & { browser: typeof chrome }).browser.storage.local.get(key);
      return (result[key] as T) ?? null;
    } catch {
      return null;
    }
  }

  async set<T>(key: string, value: T): Promise<void> {
    // Only persist critical keys (settings, provider config)
    // Cache entries are skipped to stay under 50KB limit
    if (!SafariStorageAdapter.CRITICAL_KEYS.some(k => key.startsWith(k))) {
      // Non-critical keys (like cache) are not persisted on Safari
      return;
    }

    const serialized = JSON.stringify(value);
    if (serialized.length > SafariStorageAdapter.MAX_STORAGE_SIZE) {
      console.warn('[Lex Safari] Storage limit exceeded, truncating data');
      return;
    }

    await (globalThis as typeof globalThis & { browser: typeof chrome }).browser.storage.local.set({ [key]: value });
  }

  async remove(key: string): Promise<void> {
    try {
      await (globalThis as typeof globalThis & { browser: typeof chrome }).browser.storage.local.remove(key);
    } catch {
      // Ignore removal errors
    }
  }

  async getAll(): Promise<Record<string, unknown>> {
    try {
      return await (globalThis as typeof globalThis & { browser: typeof chrome }).browser.storage.local.get(null);
    } catch {
      return {};
    }
  }

  async removeMany(keys: string[]): Promise<void> {
    if (keys.length > 0) {
      try {
        await (globalThis as typeof globalThis & { browser: typeof chrome }).browser.storage.local.remove(keys);
      } catch {
        // Ignore removal errors
      }
    }
  }
}

// Build-time platform constant injected by Vite
declare const __PLATFORM__: string | undefined;

/**
 * Detect the current platform and return the appropriate storage adapter.
 */
function detectPlatform(): 'chrome' | 'safari' {
  // Build-time platform detection via Vite define
  if (typeof __PLATFORM__ !== 'undefined' && __PLATFORM__ === 'safari') {
    return 'safari';
  }

  // Runtime detection: check if we're in Safari by looking for the browser namespace
  if (typeof globalThis !== 'undefined') {
    const g = globalThis as typeof globalThis & {
      browser?: typeof chrome;
      chrome?: typeof chrome;
    };

    // Safari iOS uses browser.* namespace
    if (g.browser?.storage && !g.chrome?.storage) {
      return 'safari';
    }
  }

  return 'chrome';
}

// Singleton instance
let storageAdapter: StorageAdapter | null = null;

/**
 * Get the storage adapter for the current platform.
 * Returns a singleton instance.
 */
export function getStorageAdapter(): StorageAdapter {
  if (!storageAdapter) {
    const platform = detectPlatform();
    storageAdapter = platform === 'safari'
      ? new SafariStorageAdapter()
      : new ChromeStorageAdapter();
  }
  return storageAdapter;
}

/**
 * Reset the storage adapter (useful for testing).
 */
export function resetStorageAdapter(): void {
  storageAdapter = null;
}
