import { providerRegistry } from './registry';
import { FreeDictionaryProvider } from './free-dictionary';
import { MerriamWebsterProvider } from './merriam-webster';
import { JishoProvider } from './jisho';
import { OpenAIProvider } from './openai';

/**
 * Register all built-in providers.
 * Additional providers can be added here.
 */
export function registerAllProviders(): void {
  providerRegistry.register(new FreeDictionaryProvider());
  providerRegistry.register(new MerriamWebsterProvider());
  providerRegistry.register(new JishoProvider());
  providerRegistry.register(new OpenAIProvider());
}

// Re-export types and registry
export * from './types';
export { providerRegistry } from './registry';
export { BaseProvider } from './base-provider';
