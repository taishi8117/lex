/**
 * Standardized definition result that all providers must return.
 */
export interface Definition {
  partOfSpeech?: string;
  definition: string;
  examples?: string[];
  synonyms?: string[];
  antonyms?: string[];
}

export interface Pronunciation {
  text?: string;
  audioUrl?: string;
}

export interface DictionaryResult {
  word: string;
  pronunciations?: Pronunciation[];
  definitions: Definition[];
  etymology?: string;
  sourceUrl?: string;
}

export interface ProviderError {
  code: 'NOT_FOUND' | 'RATE_LIMITED' | 'API_ERROR' | 'NETWORK_ERROR' | 'CONFIG_ERROR';
  message: string;
  retryable: boolean;
}

export type LookupResult =
  | { success: true; data: DictionaryResult }
  | { success: false; error: ProviderError };

/**
 * Configuration field schema for dynamic options UI generation.
 */
export interface ProviderConfigField {
  key: string;
  label: string;
  type: 'text' | 'password' | 'boolean' | 'select' | 'number';
  required: boolean;
  default?: string | boolean | number;
  options?: { value: string; label: string }[];
  description?: string;
  placeholder?: string;
}

/**
 * Metadata about a provider - used for UI and registration.
 */
export interface ProviderMetadata {
  id: string;
  name: string;
  description: string;
  supportedLanguages: string[];
  requiresApiKey: boolean;
  configFields: ProviderConfigField[];
  defaultEnabled: boolean;
  defaultOrder: number;
  website?: string;
}

/**
 * The main interface that all dictionary providers must implement.
 */
export interface DictionaryProvider {
  readonly metadata: ProviderMetadata;

  /**
   * Initialize the provider with user configuration.
   */
  initialize(config: Record<string, unknown>): Promise<void>;

  /**
   * Perform a dictionary lookup.
   */
  lookup(word: string, language?: string): Promise<LookupResult>;

  /**
   * Check if the provider supports a given language.
   */
  supportsLanguage(language: string): boolean;

  /**
   * Validate the current configuration.
   */
  validateConfig(): Promise<{ valid: boolean; message?: string }>;

  /**
   * Optional cleanup when provider is disabled.
   */
  dispose?(): void;
}

/**
 * Registration entry in the provider registry.
 */
export interface ProviderRegistration {
  provider: DictionaryProvider;
  enabled: boolean;
  order: number;
  config: Record<string, unknown>;
}
