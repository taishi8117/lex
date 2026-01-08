// API Endpoints
export const API_ENDPOINTS = {
  FREE_DICTIONARY: 'https://api.dictionaryapi.dev/api/v2/entries/en',
  JISHO: 'https://jisho.org/api/v1/search/words',
  OPENAI: 'https://api.openai.com/v1/chat/completions',
} as const;

// Default settings
export const DEFAULT_SETTINGS = {
  ui: {
    popupWidth: 380,
    popupMaxHeight: 450,
    theme: 'system' as const,
    expandFirstResult: true,
  },
  behavior: {
    triggerMode: 'doubleClick' as const,
    cacheEnabled: true,
    cacheDurationMinutes: 60 * 24 * 7, // 7 days
  },
  sources: [] as { id: string; enabled: boolean; order: number; config: Record<string, unknown> }[],
};

// Cache configuration
export const CACHE_CONFIG = {
  MEMORY_MAX_ENTRIES: 100,
  SESSION_KEY_PREFIX: 'lex_cache_',
  STORAGE_KEY_PREFIX: 'lex_cache_',
  DEFAULT_TTL_MS: 7 * 24 * 60 * 60 * 1000, // 7 days
  OPENAI_TTL_MS: 24 * 60 * 60 * 1000, // 24 hours for AI-generated content
} as const;

// Timeouts
export const TIMEOUTS = {
  LOOKUP: 8000, // 8 seconds per source
  OPENAI: 30000, // 30 seconds for OpenAI (mobile networks can be slow)
} as const;

// UI Constants
export const UI = {
  POPUP_Z_INDEX: 2147483647,
  ANIMATION_DURATION_MS: 250,
  DEBOUNCE_MS: 100,
} as const;
