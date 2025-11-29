import { BaseProvider } from './base-provider';
import type { DictionaryResult, LookupResult, ProviderMetadata } from './types';
import { API_ENDPOINTS } from '@/shared/constants';

interface FreeDictionaryPhonetic {
  text?: string;
  audio?: string;
}

interface FreeDictionaryDefinition {
  definition: string;
  example?: string;
  synonyms?: string[];
  antonyms?: string[];
}

interface FreeDictionaryMeaning {
  partOfSpeech: string;
  definitions: FreeDictionaryDefinition[];
  synonyms?: string[];
  antonyms?: string[];
}

interface FreeDictionaryEntry {
  word: string;
  phonetics?: FreeDictionaryPhonetic[];
  meanings?: FreeDictionaryMeaning[];
  origin?: string;
  sourceUrls?: string[];
}

/**
 * Free Dictionary API provider.
 * No API key required, supports English.
 * @see https://dictionaryapi.dev/
 */
export class FreeDictionaryProvider extends BaseProvider {
  readonly metadata: ProviderMetadata = {
    id: 'free-dictionary',
    name: 'Free Dictionary',
    description: 'Free, open-source dictionary API with pronunciations and examples',
    supportedLanguages: ['en'],
    requiresApiKey: false,
    configFields: [],
    defaultEnabled: true,
    defaultOrder: 10,
    website: 'https://dictionaryapi.dev/',
  };

  async lookup(word: string): Promise<LookupResult> {
    // Note: This provider doesn't use context (LookupOptions)
    const url = `${API_ENDPOINTS.FREE_DICTIONARY}/${encodeURIComponent(word)}`;

    try {
      const response = await this.fetchWithTimeout(url);

      if (!response.ok) {
        if (response.status === 404) {
          return this.createError('NOT_FOUND', 'Word not found');
        }
        return this.createError('API_ERROR', `HTTP ${response.status}`);
      }

      const data: FreeDictionaryEntry[] = await response.json();
      const entry = data[0];

      if (!entry) {
        return this.createError('NOT_FOUND', 'No results found');
      }

      const result: DictionaryResult = {
        word: entry.word,
        pronunciations: entry.phonetics
          ?.filter((p) => p.text || p.audio)
          .map((p) => ({
            text: p.text,
            audioUrl: p.audio,
          })),
        definitions:
          entry.meanings?.flatMap((meaning) =>
            meaning.definitions.map((def) => ({
              partOfSpeech: meaning.partOfSpeech,
              definition: def.definition,
              examples: def.example ? [def.example] : undefined,
              synonyms:
                def.synonyms?.length || meaning.synonyms?.length
                  ? [...(def.synonyms || []), ...(meaning.synonyms || [])].slice(0, 5)
                  : undefined,
              antonyms:
                def.antonyms?.length || meaning.antonyms?.length
                  ? [...(def.antonyms || []), ...(meaning.antonyms || [])].slice(0, 5)
                  : undefined,
            }))
          ) || [],
        etymology: entry.origin,
        sourceUrl: entry.sourceUrls?.[0] || `https://en.wiktionary.org/wiki/${encodeURIComponent(word)}`,
      };

      return this.createSuccess(result);
    } catch (error) {
      return this.handleFetchError(error);
    }
  }
}
