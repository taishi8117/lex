// Settings types
export interface SourceSettings {
  id: string;
  enabled: boolean;
  order: number;
  config: Record<string, unknown>;
}

export interface UISettings {
  popupWidth: number;
  popupMaxHeight: number;
  theme: 'light' | 'dark' | 'system';
  expandFirstResult: boolean;
}

export interface BehaviorSettings {
  triggerMode: 'doubleClick' | 'selection' | 'both';
  cacheEnabled: boolean;
  cacheDurationMinutes: number;
}

export interface AppSettings {
  sources: SourceSettings[];
  ui: UISettings;
  behavior: BehaviorSettings;
}

// Message types for communication between content script and background
export interface LookupMessage {
  type: 'LOOKUP';
  word: string;
}

export interface LookupResponseMessage {
  type: 'LOOKUP_RESPONSE';
  results: AggregatedResult;
}

export interface SettingsMessage {
  type: 'GET_SETTINGS' | 'SAVE_SETTINGS';
  settings?: Partial<AppSettings>;
}

export type ExtensionMessage = LookupMessage | LookupResponseMessage | SettingsMessage;

// Aggregated lookup result from all sources
export interface AggregatedResult {
  word: string;
  results: SourceLookupResult[];
  totalDuration: number;
}

export interface SourceLookupResult {
  providerId: string;
  providerName: string;
  result: import('@/providers/types').LookupResult;
  duration: number;
}
