import { BaseProvider } from './base-provider';
import type { DictionaryResult, LookupResult, ProviderMetadata } from './types';
import { API_ENDPOINTS, TIMEOUTS } from '@/shared/constants';

interface OpenAIMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface OpenAIResponse {
  choices: Array<{
    message: {
      content: string;
    };
  }>;
  error?: {
    message: string;
    type: string;
  };
}

interface UsageExample {
  sentence: string;
  context: string;
  register?: string;
}

interface AIResponse {
  definition?: string;
  examples: UsageExample[];
  collocations?: string[];
  usage_notes?: string;
}

/**
 * OpenAI-powered provider for usage examples and learning context.
 * Requires paid API key from https://platform.openai.com/
 */
export class OpenAIProvider extends BaseProvider {
  readonly metadata: ProviderMetadata = {
    id: 'openai',
    name: 'AI Usage Examples',
    description: 'AI-generated usage examples and learning context powered by OpenAI',
    supportedLanguages: ['en', 'ja', 'es', 'fr', 'de', 'zh', 'ko'],
    requiresApiKey: true,
    configFields: [
      {
        key: 'apiKey',
        label: 'OpenAI API Key',
        type: 'password',
        required: true,
        description: 'Get your API key from platform.openai.com',
        placeholder: 'sk-...',
      },
      {
        key: 'model',
        label: 'Model',
        type: 'select',
        required: false,
        default: 'gpt-4o-mini',
        options: [
          { value: 'gpt-4o-mini', label: 'GPT-4o Mini (Fast & Cheap)' },
          { value: 'gpt-4o', label: 'GPT-4o (Best Quality)' },
          { value: 'gpt-3.5-turbo', label: 'GPT-3.5 Turbo (Legacy)' },
        ],
      },
      {
        key: 'numExamples',
        label: 'Number of Examples',
        type: 'select',
        required: false,
        default: '3',
        options: [
          { value: '2', label: '2 examples' },
          { value: '3', label: '3 examples' },
          { value: '5', label: '5 examples' },
        ],
      },
      {
        key: 'includeCollocations',
        label: 'Include common collocations',
        type: 'boolean',
        required: false,
        default: true,
      },
    ],
    defaultEnabled: false,
    defaultOrder: 50,
    website: 'https://platform.openai.com/',
  };

  async lookup(word: string): Promise<LookupResult> {
    const apiKey = this.config.apiKey as string;
    if (!apiKey) {
      return this.createError('CONFIG_ERROR', 'API key not configured');
    }

    const model = (this.config.model as string) || 'gpt-4o-mini';
    const numExamples = parseInt((this.config.numExamples as string) || '3', 10);
    const includeCollocations = this.config.includeCollocations !== false;

    const prompt = this.buildPrompt(word, numExamples, includeCollocations);

    try {
      const response = await this.fetchWithTimeout(
        API_ENDPOINTS.OPENAI,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model,
            messages: [
              {
                role: 'system',
                content:
                  'You are a helpful language learning assistant. Provide clear, natural examples that help learners understand word usage.',
              },
              {
                role: 'user',
                content: prompt,
              },
            ] as OpenAIMessage[],
            temperature: 0.7,
            max_tokens: 500,
          }),
        },
        TIMEOUTS.OPENAI
      );

      if (!response.ok) {
        if (response.status === 401) {
          return this.createError('CONFIG_ERROR', 'Invalid API key');
        }
        if (response.status === 429) {
          return this.createError('RATE_LIMITED', 'Rate limit exceeded', true);
        }
        const errorData = await response.json().catch(() => ({}));
        return this.createError(
          'API_ERROR',
          (errorData as OpenAIResponse).error?.message || `HTTP ${response.status}`
        );
      }

      const data: OpenAIResponse = await response.json();
      const content = data.choices?.[0]?.message?.content;

      if (!content) {
        return this.createError('API_ERROR', 'Empty response from OpenAI');
      }

      const result = this.parseResponse(word, content);
      return this.createSuccess(result);
    } catch (error) {
      return this.handleFetchError(error);
    }
  }

  private buildPrompt(word: string, numExamples: number, includeCollocations: boolean): string {
    let prompt = `Generate ${numExamples} natural example sentences using the word or phrase "${word}".

For each example, provide:
1. A natural sentence using the word
2. Context explaining when/how this usage is appropriate
3. Register (formal, informal, neutral, technical, etc.)

`;

    if (includeCollocations) {
      prompt += `Also include 3-5 common collocations (words that frequently appear with "${word}").

`;
    }

    prompt += `Respond in JSON format:
{
  "examples": [
    {
      "sentence": "Example sentence here",
      "context": "When/how to use this",
      "register": "informal"
    }
  ]${includeCollocations ? `,
  "collocations": ["word1", "word2"]` : ''}
}`;

    return prompt;
  }

  private parseResponse(word: string, content: string): DictionaryResult {
    let parsed: AIResponse;

    try {
      // Try to extract JSON from the response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsed = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('No JSON found');
      }
    } catch {
      // Fallback: treat entire response as a single example
      return {
        word,
        definitions: [
          {
            partOfSpeech: 'AI Examples',
            definition: 'Usage examples and context',
            examples: [content.trim()],
          },
        ],
      };
    }

    const examples = parsed.examples || [];
    const collocations = parsed.collocations || [];

    const formattedExamples = examples.map((ex) => {
      let example = ex.sentence;
      if (ex.context) {
        example += ` — ${ex.context}`;
      }
      if (ex.register) {
        example += ` [${ex.register}]`;
      }
      return example;
    });

    const definitions: DictionaryResult['definitions'] = [];

    if (formattedExamples.length > 0) {
      definitions.push({
        partOfSpeech: 'usage examples',
        definition: `Natural examples showing how to use "${word}"`,
        examples: formattedExamples,
      });
    }

    if (collocations.length > 0) {
      definitions.push({
        partOfSpeech: 'collocations',
        definition: `Words commonly used with "${word}"`,
        examples: [collocations.join(', ')],
      });
    }

    if (parsed.usage_notes) {
      definitions.push({
        partOfSpeech: 'usage notes',
        definition: parsed.usage_notes,
      });
    }

    return {
      word,
      definitions,
    };
  }

  async validateConfig(): Promise<{ valid: boolean; message?: string }> {
    const apiKey = this.config.apiKey as string;
    if (!apiKey) {
      return { valid: false, message: 'API key is required' };
    }

    if (!apiKey.startsWith('sk-')) {
      return { valid: false, message: 'Invalid API key format' };
    }

    // Test with a minimal request
    try {
      const response = await this.fetchWithTimeout(
        API_ENDPOINTS.OPENAI,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model: 'gpt-4o-mini',
            messages: [{ role: 'user', content: 'test' }],
            max_tokens: 1,
          }),
        },
        5000
      );

      if (response.status === 401) {
        return { valid: false, message: 'Invalid API key' };
      }

      if (response.status === 429) {
        return { valid: true, message: 'API key valid (rate limited)' };
      }

      return { valid: true, message: 'API key verified' };
    } catch {
      return { valid: false, message: 'Could not verify API key' };
    }
  }
}
