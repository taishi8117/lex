import { BaseProvider } from './base-provider';
import type { DictionaryResult, LookupResult, ProviderMetadata } from './types';

interface UrbanDictionaryEntry {
  definition: string;
  permalink: string;
  thumbs_up: number;
  thumbs_down: number;
  author: string;
  word: string;
  example: string;
  written_on: string;
}

interface UrbanDictionaryResponse {
  list: UrbanDictionaryEntry[];
}

/**
 * Urban Dictionary API provider.
 * Returns slang definitions and informal usage.
 * @see https://api.urbandictionary.com/
 */
export class UrbanDictionaryProvider extends BaseProvider {
  readonly metadata: ProviderMetadata = {
    id: 'urban-dictionary',
    name: 'Urban Dictionary',
    description: 'Slang, informal terms, and internet culture definitions',
    supportedLanguages: ['en'],
    requiresApiKey: false,
    configFields: [],
    defaultEnabled: true,
    defaultOrder: 35,
    website: 'https://www.urbandictionary.com/',
  };

  async lookup(word: string): Promise<LookupResult> {
    const url = `https://api.urbandictionary.com/v0/define?term=${encodeURIComponent(word)}`;

    try {
      const response = await this.fetchWithTimeout(url);

      if (!response.ok) {
        return this.createError('API_ERROR', `HTTP ${response.status}`);
      }

      const data: UrbanDictionaryResponse = await response.json();

      if (!data.list || data.list.length === 0) {
        return this.createError('NOT_FOUND', 'No definitions found');
      }

      // Sort by popularity (thumbs_up - thumbs_down) and take top 3
      const sorted = data.list
        .sort((a, b) => (b.thumbs_up - b.thumbs_down) - (a.thumbs_up - a.thumbs_down))
        .slice(0, 3);

      // Clean up Urban Dictionary's bracket notation [word] -> word
      const cleanText = (text: string): string =>
        text.replace(/\[([^\]]+)\]/g, '$1').trim();

      const result: DictionaryResult = {
        word: sorted[0].word,
        definitions: sorted.map((entry) => ({
          partOfSpeech: 'slang',
          definition: cleanText(entry.definition),
          examples: entry.example ? [cleanText(entry.example)] : undefined,
        })),
        sourceUrl: sorted[0].permalink,
      };

      return this.createSuccess(result);
    } catch (error) {
      return this.handleFetchError(error);
    }
  }
}
