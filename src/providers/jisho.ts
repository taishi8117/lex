import { BaseProvider } from './base-provider';
import type { DictionaryResult, LookupResult, ProviderMetadata, Definition } from './types';
import { API_ENDPOINTS } from '@/shared/constants';

interface JishoSense {
  english_definitions: string[];
  parts_of_speech: string[];
  tags: string[];
  info: string[];
  see_also: string[];
}

interface JishoJapanese {
  word?: string;
  reading: string;
}

interface JishoData {
  slug: string;
  is_common: boolean;
  tags: string[];
  jlpt: string[];
  japanese: JishoJapanese[];
  senses: JishoSense[];
}

interface JishoResponse {
  meta: { status: number };
  data: JishoData[];
}

/**
 * Jisho.org Japanese-English dictionary provider.
 * No API key required.
 * @see https://jisho.org/
 */
export class JishoProvider extends BaseProvider {
  readonly metadata: ProviderMetadata = {
    id: 'jisho',
    name: 'Jisho (Japanese)',
    description: 'Japanese-English dictionary powered by JMdict',
    supportedLanguages: ['ja', 'en'],
    requiresApiKey: false,
    configFields: [
      {
        key: 'showReading',
        label: 'Show readings (hiragana/katakana)',
        type: 'boolean',
        required: false,
        default: true,
      },
      {
        key: 'showJLPT',
        label: 'Show JLPT level',
        type: 'boolean',
        required: false,
        default: true,
      },
    ],
    defaultEnabled: false,
    defaultOrder: 40,
    website: 'https://jisho.org/',
  };

  async lookup(word: string): Promise<LookupResult> {
    // Note: This provider doesn't use context (LookupOptions)
    const url = `${API_ENDPOINTS.JISHO}?keyword=${encodeURIComponent(word)}`;

    try {
      const response = await this.fetchWithTimeout(url);

      if (!response.ok) {
        return this.createError('API_ERROR', `HTTP ${response.status}`);
      }

      const data: JishoResponse = await response.json();

      if (data.data.length === 0) {
        return this.createError('NOT_FOUND', 'Word not found');
      }

      const result = this.parseResponse(word, data.data);
      return this.createSuccess(result);
    } catch (error) {
      return this.handleFetchError(error);
    }
  }

  private parseResponse(searchWord: string, entries: JishoData[]): DictionaryResult {
    const definitions: Definition[] = [];
    const showReading = this.config.showReading !== false;
    const showJLPT = this.config.showJLPT !== false;

    // Take top 5 results to avoid overwhelming the user
    const topEntries = entries.slice(0, 5);

    for (const entry of topEntries) {
      const japanese = entry.japanese[0];
      const word = japanese.word || japanese.reading;
      const reading = japanese.word ? japanese.reading : undefined;

      // Build definition prefix with Japanese word info
      const wordInfo: string[] = [];
      if (showReading && reading) {
        wordInfo.push(`${word} (${reading})`);
      } else {
        wordInfo.push(word);
      }

      if (showJLPT && entry.jlpt.length > 0) {
        wordInfo.push(`[${entry.jlpt.join(', ')}]`);
      }

      if (entry.is_common) {
        wordInfo.push('(common)');
      }

      // Parse senses as definitions
      for (const sense of entry.senses) {
        const partOfSpeech = sense.parts_of_speech.join(', ') || 'unknown';
        const definition = sense.english_definitions.join('; ');

        const examples: string[] = [];
        if (sense.info.length > 0) {
          examples.push(...sense.info);
        }
        if (sense.see_also.length > 0) {
          examples.push(`See also: ${sense.see_also.join(', ')}`);
        }

        definitions.push({
          partOfSpeech: `${partOfSpeech}${wordInfo.length > 1 ? ` — ${wordInfo.join(' ')}` : ''}`,
          definition,
          examples: examples.length > 0 ? examples : undefined,
        });
      }
    }

    // Get the main word for display
    const mainEntry = entries[0];
    const mainJapanese = mainEntry.japanese[0];
    const displayWord = mainJapanese.word || mainJapanese.reading;

    return {
      word: displayWord,
      pronunciations: mainJapanese.word
        ? [{ text: mainJapanese.reading }]
        : undefined,
      definitions,
      sourceUrl: `https://jisho.org/search/${encodeURIComponent(searchWord)}`,
    };
  }
}
