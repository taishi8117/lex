import { BaseProvider } from './base-provider';
import type { DictionaryResult, LookupResult, ProviderMetadata, Definition } from './types';

interface MWSense {
  sn?: string;
  dt?: Array<['text' | 'vis' | 'uns', unknown]>;
  sdsense?: {
    sd: string;
    dt: Array<['text' | 'vis' | 'uns', unknown]>;
  };
}

interface MWEntry {
  meta?: {
    id: string;
    stems?: string[];
    syns?: string[][];
    ants?: string[][];
  };
  hwi?: {
    hw: string;
    prs?: Array<{
      mw?: string;
      sound?: { audio: string };
    }>;
  };
  fl?: string;
  def?: Array<{
    sseq: Array<Array<['sense' | 'bs' | 'sen', MWSense]>>;
  }>;
  shortdef?: string[];
  et?: Array<['text', string]>;
}

/**
 * Base class for Merriam-Webster dictionary providers.
 */
abstract class BaseMWProvider extends BaseProvider {
  protected abstract readonly apiEndpoint: string;
  protected abstract readonly webUrl: string;

  async lookup(word: string): Promise<LookupResult> {
    const apiKey = this.config.apiKey as string;
    if (!apiKey) {
      return this.createError('CONFIG_ERROR', 'API key not configured');
    }

    const url = `${this.apiEndpoint}/${encodeURIComponent(word)}?key=${apiKey}`;

    try {
      const response = await this.fetchWithTimeout(url);

      if (!response.ok) {
        if (response.status === 403) {
          return this.createError('CONFIG_ERROR', 'Invalid API key');
        }
        return this.createError('API_ERROR', `HTTP ${response.status}`);
      }

      const data: MWEntry[] | string[] = await response.json();

      // If result is array of strings, it means no exact match found (suggestions)
      if (data.length === 0 || typeof data[0] === 'string') {
        return this.createError('NOT_FOUND', 'Word not found');
      }

      const entries = data as MWEntry[];
      const result = this.parseEntries(word, entries);

      if (result.definitions.length === 0) {
        return this.createError('NOT_FOUND', 'No definitions found');
      }

      return this.createSuccess(result);
    } catch (error) {
      return this.handleFetchError(error);
    }
  }

  protected parseEntries(word: string, entries: MWEntry[]): DictionaryResult {
    const definitions: Definition[] = [];
    let pronunciations: DictionaryResult['pronunciations'] = [];
    let etymology: string | undefined;

    for (const entry of entries) {
      // Extract pronunciations from first entry
      if (pronunciations.length === 0 && entry.hwi?.prs) {
        pronunciations = entry.hwi.prs
          .filter((p) => p.mw || p.sound?.audio)
          .map((p) => ({
            text: p.mw ? `/${p.mw}/` : undefined,
            audioUrl: p.sound?.audio ? this.getAudioUrl(p.sound.audio) : undefined,
          }));
      }

      // Extract etymology from first entry
      if (!etymology && entry.et) {
        const etText = entry.et.find((e) => e[0] === 'text');
        if (etText) {
          etymology = this.cleanText(etText[1] as string);
        }
      }

      // Extract definitions
      const partOfSpeech = entry.fl || 'unknown';

      // Use shortdef for simpler parsing
      if (entry.shortdef && entry.shortdef.length > 0) {
        for (const def of entry.shortdef) {
          definitions.push({
            partOfSpeech,
            definition: def,
            synonyms: entry.meta?.syns?.flat().slice(0, 5),
            antonyms: entry.meta?.ants?.flat().slice(0, 5),
          });
        }
      }
    }

    return {
      word,
      pronunciations: pronunciations.length > 0 ? pronunciations : undefined,
      definitions,
      etymology,
      sourceUrl: `${this.webUrl}/${encodeURIComponent(word)}`,
    };
  }

  protected getAudioUrl(audio: string): string {
    let subdir: string;
    if (audio.startsWith('bix')) {
      subdir = 'bix';
    } else if (audio.startsWith('gg')) {
      subdir = 'gg';
    } else if (/^[0-9]/.test(audio)) {
      subdir = 'number';
    } else {
      subdir = audio.charAt(0);
    }
    return `https://media.merriam-webster.com/audio/prons/en/us/mp3/${subdir}/${audio}.mp3`;
  }

  protected cleanText(text: string): string {
    return text
      .replace(/\{[^}]+\}/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  async validateConfig(): Promise<{ valid: boolean; message?: string }> {
    const apiKey = this.config.apiKey as string;
    if (!apiKey) {
      return { valid: false, message: 'API key is required' };
    }

    try {
      const url = `${this.apiEndpoint}/test?key=${apiKey}`;
      const response = await this.fetchWithTimeout(url, {}, 3000);

      if (response.status === 403) {
        return { valid: false, message: 'Invalid API key' };
      }

      return { valid: true, message: 'API key verified' };
    } catch {
      return { valid: false, message: 'Could not verify API key' };
    }
  }
}

/**
 * Merriam-Webster Collegiate Dictionary API provider.
 * Requires API key from https://dictionaryapi.com/
 */
export class MWCollegiateProvider extends BaseMWProvider {
  protected readonly apiEndpoint = 'https://www.dictionaryapi.com/api/v3/references/collegiate/json';
  protected readonly webUrl = 'https://www.merriam-webster.com/dictionary';

  readonly metadata: ProviderMetadata = {
    id: 'mw-collegiate',
    name: "Merriam-Webster Collegiate",
    description: "America's most trusted dictionary for advanced users",
    supportedLanguages: ['en'],
    requiresApiKey: true,
    configFields: [
      {
        key: 'apiKey',
        label: 'Collegiate Dictionary API Key',
        type: 'password',
        required: true,
        description: 'Get a free API key from dictionaryapi.com (Collegiate Dictionary)',
        placeholder: 'Enter your Collegiate API key',
      },
    ],
    defaultEnabled: false,
    defaultOrder: 20,
    website: 'https://dictionaryapi.com/',
  };
}

/**
 * Merriam-Webster Learner's Dictionary API provider.
 * Requires API key from https://dictionaryapi.com/
 */
export class MWLearnersProvider extends BaseMWProvider {
  protected readonly apiEndpoint = 'https://www.dictionaryapi.com/api/v3/references/learners/json';
  protected readonly webUrl = 'https://www.learnersdictionary.com/definition';

  readonly metadata: ProviderMetadata = {
    id: 'mw-learners',
    name: "Merriam-Webster Learner's",
    description: 'Dictionary designed for English language learners with simpler definitions',
    supportedLanguages: ['en'],
    requiresApiKey: true,
    configFields: [
      {
        key: 'apiKey',
        label: "Learner's Dictionary API Key",
        type: 'password',
        required: true,
        description: "Get a free API key from dictionaryapi.com (Learner's Dictionary)",
        placeholder: "Enter your Learner's API key",
      },
    ],
    defaultEnabled: false,
    defaultOrder: 25,
    website: 'https://dictionaryapi.com/',
  };
}
