import type { AppSettings } from '@/shared/types';
import { DEFAULT_SETTINGS } from '@/shared/constants';
import { getStorageAdapter } from './storage-adapter';

const SETTINGS_KEY = 'lex_settings';

/**
 * Service for managing application settings via storage adapter.
 * Works with both Chrome and Safari storage backends.
 */
class SettingsServiceImpl {
  private cache: AppSettings | null = null;
  private storage = getStorageAdapter();

  /**
   * Get current settings, loading from storage if needed.
   */
  async get(): Promise<AppSettings> {
    if (this.cache) {
      return this.cache;
    }

    try {
      const stored = await this.storage.get<Partial<AppSettings>>(SETTINGS_KEY);

      this.cache = {
        ...DEFAULT_SETTINGS,
        ...stored,
        ui: { ...DEFAULT_SETTINGS.ui, ...stored?.ui },
        behavior: { ...DEFAULT_SETTINGS.behavior, ...stored?.behavior },
      };

      return this.cache;
    } catch {
      return DEFAULT_SETTINGS;
    }
  }

  /**
   * Update settings.
   */
  async update(updates: Partial<AppSettings>): Promise<void> {
    const current = await this.get();

    this.cache = {
      ...current,
      ...updates,
      ui: updates.ui ? { ...current.ui, ...updates.ui } : current.ui,
      behavior: updates.behavior ? { ...current.behavior, ...updates.behavior } : current.behavior,
    };

    await this.storage.set(SETTINGS_KEY, this.cache);
  }

  /**
   * Reset settings to defaults.
   */
  async reset(): Promise<void> {
    this.cache = { ...DEFAULT_SETTINGS };
    await this.storage.set(SETTINGS_KEY, this.cache);
  }

  /**
   * Clear the settings cache.
   */
  clearCache(): void {
    this.cache = null;
  }
}

export const settingsService = new SettingsServiceImpl();
