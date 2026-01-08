import type { DictionaryProvider, ProviderRegistration } from './types';
import { getStorageAdapter } from '@/services/storage-adapter';

/**
 * Singleton registry for managing dictionary providers.
 * Enables the plugin architecture where providers can be registered,
 * enabled/disabled, and reordered dynamically.
 */
class ProviderRegistryImpl {
  private providers: Map<string, ProviderRegistration> = new Map();
  private static instance: ProviderRegistryImpl;
  private storage = getStorageAdapter();

  static getInstance(): ProviderRegistryImpl {
    if (!this.instance) {
      this.instance = new ProviderRegistryImpl();
    }
    return this.instance;
  }

  /**
   * Register a new provider.
   */
  register(provider: DictionaryProvider): void {
    const { id, defaultEnabled, defaultOrder } = provider.metadata;

    if (this.providers.has(id)) {
      console.warn(`[Lex] Provider "${id}" already registered, skipping.`);
      return;
    }

    this.providers.set(id, {
      provider,
      enabled: defaultEnabled,
      order: defaultOrder,
      config: this.getDefaultConfig(provider),
    });
  }

  /**
   * Unregister a provider by ID.
   */
  unregister(providerId: string): void {
    const registration = this.providers.get(providerId);
    if (registration) {
      registration.provider.dispose?.();
      this.providers.delete(providerId);
    }
  }

  /**
   * Get a provider by ID.
   */
  getProvider(id: string): DictionaryProvider | undefined {
    return this.providers.get(id)?.provider;
  }

  /**
   * Get registration info for a provider.
   */
  getRegistration(id: string): ProviderRegistration | undefined {
    return this.providers.get(id);
  }

  /**
   * Get all registered providers.
   */
  getAllProviders(): DictionaryProvider[] {
    return Array.from(this.providers.values())
      .sort((a, b) => a.order - b.order)
      .map((reg) => reg.provider);
  }

  /**
   * Get all provider registrations (for options UI).
   */
  getAllRegistrations(): ProviderRegistration[] {
    return Array.from(this.providers.values()).sort((a, b) => a.order - b.order);
  }

  /**
   * Get only enabled providers, sorted by order.
   */
  getEnabledProviders(): DictionaryProvider[] {
    return Array.from(this.providers.values())
      .filter((reg) => reg.enabled)
      .sort((a, b) => a.order - b.order)
      .map((reg) => reg.provider);
  }

  /**
   * Update configuration for a provider.
   */
  updateConfig(
    providerId: string,
    update: Partial<Pick<ProviderRegistration, 'enabled' | 'order' | 'config'>>
  ): void {
    const registration = this.providers.get(providerId);
    if (!registration) {
      console.warn(`[Lex] Provider "${providerId}" not found.`);
      return;
    }

    if (update.enabled !== undefined) {
      registration.enabled = update.enabled;
    }
    if (update.order !== undefined) {
      registration.order = update.order;
    }
    if (update.config !== undefined) {
      registration.config = { ...registration.config, ...update.config };
      // Re-initialize provider with new config
      registration.provider.initialize(registration.config);
    }
  }

  /**
   * Load saved settings from storage and apply to registrations.
   */
  async loadFromStorage(): Promise<void> {
    try {
      const saved = await this.storage.get<
        Record<string, { enabled: boolean; order: number; config: Record<string, unknown> }>
      >('lex_provider_settings');

      if (saved) {
        for (const [id, settings] of Object.entries(saved)) {
          if (this.providers.has(id)) {
            this.updateConfig(id, settings);
          }
        }
      }

      // Initialize all providers
      for (const registration of this.providers.values()) {
        await registration.provider.initialize(registration.config);
      }
    } catch (error) {
      console.error('[Lex] Failed to load provider settings:', error);
    }
  }

  /**
   * Save current settings to storage.
   */
  async saveToStorage(): Promise<void> {
    const settings: Record<
      string,
      { enabled: boolean; order: number; config: Record<string, unknown> }
    > = {};

    for (const [id, reg] of this.providers) {
      settings[id] = {
        enabled: reg.enabled,
        order: reg.order,
        config: reg.config,
      };
    }

    await this.storage.set('lex_provider_settings', settings);
  }

  /**
   * Get default config values from provider metadata.
   */
  private getDefaultConfig(provider: DictionaryProvider): Record<string, unknown> {
    const config: Record<string, unknown> = {};
    for (const field of provider.metadata.configFields) {
      if (field.default !== undefined) {
        config[field.key] = field.default;
      }
    }
    return config;
  }
}

export const providerRegistry = ProviderRegistryImpl.getInstance();
