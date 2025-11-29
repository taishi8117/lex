import type {
  DictionaryProvider,
  DictionaryResult,
  LookupOptions,
  LookupResult,
  ProviderError,
  ProviderMetadata,
} from './types';

/**
 * Abstract base class for dictionary providers.
 * Provides common functionality and helper methods.
 */
export abstract class BaseProvider implements DictionaryProvider {
  abstract readonly metadata: ProviderMetadata;

  protected config: Record<string, unknown> = {};
  protected initialized = false;

  async initialize(config: Record<string, unknown>): Promise<void> {
    this.config = config;
    this.initialized = true;
  }

  supportsLanguage(language: string): boolean {
    return this.metadata.supportedLanguages.includes(language);
  }

  async validateConfig(): Promise<{ valid: boolean; message?: string }> {
    if (this.metadata.requiresApiKey && !this.config.apiKey) {
      return { valid: false, message: 'API key is required' };
    }
    return { valid: true };
  }

  abstract lookup(word: string, options?: LookupOptions): Promise<LookupResult>;

  dispose(): void {
    this.initialized = false;
    this.config = {};
  }

  // Helper methods for subclasses

  protected createError(
    code: ProviderError['code'],
    message: string,
    retryable = false
  ): LookupResult {
    return {
      success: false,
      error: { code, message, retryable },
    };
  }

  protected createSuccess(data: DictionaryResult): LookupResult {
    return { success: true, data };
  }

  protected async fetchWithTimeout(
    url: string,
    options: RequestInit = {},
    timeoutMs = 5000
  ): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });
      return response;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  protected handleFetchError(error: unknown): LookupResult {
    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        return this.createError('NETWORK_ERROR', 'Request timed out', true);
      }
      return this.createError('NETWORK_ERROR', error.message, true);
    }
    return this.createError('NETWORK_ERROR', 'Unknown error occurred', true);
  }
}
