import { BaseProvider } from './base-provider';
import type { DictionaryResult, LookupResult, ProviderMetadata } from './types';

interface WikipediaSummary {
  title: string;
  extract: string;
  description?: string;
  content_urls?: {
    desktop?: { page?: string };
  };
  thumbnail?: {
    source: string;
    width: number;
    height: number;
  };
  type: string;
}

/**
 * Wikipedia API provider.
 * Returns article summaries for proper nouns, concepts, and general knowledge.
 * @see https://en.wikipedia.org/api/rest_v1/
 */
export class WikipediaProvider extends BaseProvider {
  readonly metadata: ProviderMetadata = {
    id: 'wikipedia',
    name: 'Wikipedia',
    description: 'Encyclopedia summaries for concepts, people, places, and things',
    supportedLanguages: ['en'],
    requiresApiKey: false,
    configFields: [],
    defaultEnabled: true,
    defaultOrder: 30,
    website: 'https://en.wikipedia.org/',
  };

  async lookup(word: string): Promise<LookupResult> {
    const url = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(word)}`;

    try {
      const response = await this.fetchWithTimeout(url);

      if (!response.ok) {
        if (response.status === 404) {
          return this.createError('NOT_FOUND', 'No Wikipedia article found');
        }
        return this.createError('API_ERROR', `HTTP ${response.status}`);
      }

      const data: WikipediaSummary = await response.json();

      // Wikipedia returns "disambiguation" or "not found" types for non-articles
      if (data.type === 'disambiguation') {
        return this.createError('NOT_FOUND', 'Disambiguation page - try a more specific term');
      }

      if (data.type === 'not_found' || !data.extract) {
        return this.createError('NOT_FOUND', 'No Wikipedia article found');
      }

      const result: DictionaryResult = {
        word: data.title,
        definitions: [
          {
            partOfSpeech: data.description || 'encyclopedia',
            definition: data.extract,
          },
        ],
        sourceUrl: data.content_urls?.desktop?.page || `https://en.wikipedia.org/wiki/${encodeURIComponent(word)}`,
      };

      return this.createSuccess(result);
    } catch (error) {
      return this.handleFetchError(error);
    }
  }
}
