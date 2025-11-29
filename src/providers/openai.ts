import { BaseProvider } from './base-provider';
import type { DictionaryResult, LookupOptions, LookupResult, ProviderMetadata } from './types';
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

interface AIAnalysis {
  type: 'word' | 'phrase' | 'sentence';
  meaning_in_context?: string;
  general_meaning?: string;
  plain_english?: string;
  collocations?: string[];
  register?: string;
  usage_notes?: string;
  nuance?: string;
  common_mistakes?: string;
  related_expressions?: string[];
}

/**
 * OpenAI-powered provider for context-aware language learning.
 * Optimized for advanced English learners who want to understand nuance.
 * Requires paid API key from https://platform.openai.com/
 */
export class OpenAIProvider extends BaseProvider {
  readonly metadata: ProviderMetadata = {
    id: 'openai',
    name: 'AI Language Analysis',
    description: 'Context-aware explanations, collocations, and usage nuances powered by AI',
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
    ],
    defaultEnabled: false,
    defaultOrder: 50,
    website: 'https://platform.openai.com/',
  };

  async lookup(word: string, options?: LookupOptions): Promise<LookupResult> {
    const apiKey = this.config.apiKey as string;
    if (!apiKey) {
      return this.createError('CONFIG_ERROR', 'API key not configured');
    }

    const model = (this.config.model as string) || 'gpt-4o-mini';
    const context = options?.context;

    // Determine input type
    const inputType = this.detectInputType(word);
    const prompt = this.buildPrompt(word, inputType, context);

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
                content: this.getSystemPrompt(),
              },
              {
                role: 'user',
                content: prompt,
              },
            ] as OpenAIMessage[],
            temperature: 0.3,
            max_tokens: 600,
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

      const result = this.parseResponse(word, content, inputType);
      return this.createSuccess(result);
    } catch (error) {
      return this.handleFetchError(error);
    }
  }

  private getSystemPrompt(): string {
    return `You are an expert English language tutor helping advanced learners understand nuances, collocations, and contextual usage.

Your responses should be:
- Precise and informative (no fluff)
- Focused on what advanced learners need: nuance, register, collocations
- Aware of the difference between formal/informal/technical usage
- Helpful for understanding meaning IN CONTEXT when context is provided

Always respond in valid JSON format as specified in the user's request.`;
  }

  private detectInputType(text: string): 'word' | 'phrase' | 'sentence' {
    const trimmed = text.trim();
    const words = trimmed.split(/\s+/);

    // Single word
    if (words.length === 1) {
      return 'word';
    }

    // Check for sentence markers (punctuation, capitalization patterns)
    if (/[.!?]$/.test(trimmed) ||
        (words.length > 4 && /^[A-Z]/.test(trimmed)) ||
        words.length > 6) {
      return 'sentence';
    }

    // Multi-word but not a sentence = phrase/idiom
    return 'phrase';
  }

  private buildPrompt(text: string, inputType: 'word' | 'phrase' | 'sentence', context?: string): string {
    const contextSection = context
      ? `\nCONTEXT (the text where this appears): "${context}"\n`
      : '';

    if (inputType === 'sentence') {
      return `Analyze this sentence for an advanced English learner:
"${text}"
${contextSection}
Explain what this sentence means in plain, clear English. Note any idiomatic expressions, unusual constructions, or nuances.

Respond in JSON:
{
  "type": "sentence",
  "plain_english": "Clear explanation of what the sentence means",
  "nuance": "Any subtle meaning, tone, or implication (optional)",
  "usage_notes": "When/how this kind of expression is used (optional)"
}`;
    }

    if (inputType === 'phrase') {
      return `Analyze this phrase/expression for an advanced English learner:
"${text}"
${contextSection}
Explain its meaning${context ? ' in this context' : ''}, how it's used, and any important nuances.

Respond in JSON:
{
  "type": "phrase",
  ${context ? '"meaning_in_context": "What it means specifically in this context",' : ''}
  "general_meaning": "The general meaning of this phrase",
  "register": "formal/informal/neutral/technical/slang",
  "usage_notes": "When and how to use this phrase",
  "related_expressions": ["similar phrases or alternatives"]
}`;
    }

    // Single word
    return `Analyze this word for an advanced English learner:
"${text}"
${contextSection}
Provide: ${context ? 'meaning in this specific context, ' : ''}collocations (words it commonly pairs with), register, and any important nuances.

Respond in JSON:
{
  "type": "word",
  ${context ? '"meaning_in_context": "What it means specifically in this context",' : ''}
  "general_meaning": "Core meaning of the word",
  "collocations": ["common word1", "common word2", "verb + word", "word + noun patterns"],
  "register": "formal/informal/neutral/technical",
  "nuance": "Subtle connotations or usage distinctions",
  "common_mistakes": "Errors learners often make with this word (optional)"
}`;
  }

  private parseResponse(word: string, content: string, inputType: string): DictionaryResult {
    let parsed: AIAnalysis;

    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsed = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('No JSON found');
      }
    } catch {
      // Fallback: treat entire response as plain text explanation
      return {
        word,
        definitions: [
          {
            partOfSpeech: 'AI Analysis',
            definition: content.trim(),
          },
        ],
      };
    }

    const definitions: DictionaryResult['definitions'] = [];

    // Context-specific meaning (most important when available)
    if (parsed.meaning_in_context) {
      definitions.push({
        partOfSpeech: 'in this context',
        definition: parsed.meaning_in_context,
      });
    }

    // Plain English for sentences
    if (parsed.plain_english) {
      definitions.push({
        partOfSpeech: 'meaning',
        definition: parsed.plain_english,
      });
    }

    // General meaning
    if (parsed.general_meaning && !parsed.plain_english) {
      definitions.push({
        partOfSpeech: inputType === 'phrase' ? 'phrase meaning' : 'general meaning',
        definition: parsed.general_meaning,
      });
    }

    // Collocations (very important for language learners)
    if (parsed.collocations && parsed.collocations.length > 0) {
      definitions.push({
        partOfSpeech: 'collocations',
        definition: `Common combinations: ${parsed.collocations.join(' · ')}`,
      });
    }

    // Register and nuance combined
    const notes: string[] = [];
    if (parsed.register) {
      notes.push(`Register: ${parsed.register}`);
    }
    if (parsed.nuance) {
      notes.push(parsed.nuance);
    }
    if (notes.length > 0) {
      definitions.push({
        partOfSpeech: 'usage',
        definition: notes.join('. '),
      });
    }

    // Usage notes
    if (parsed.usage_notes) {
      definitions.push({
        partOfSpeech: 'note',
        definition: parsed.usage_notes,
      });
    }

    // Common mistakes
    if (parsed.common_mistakes) {
      definitions.push({
        partOfSpeech: 'caution',
        definition: parsed.common_mistakes,
      });
    }

    // Related expressions for phrases
    if (parsed.related_expressions && parsed.related_expressions.length > 0) {
      definitions.push({
        partOfSpeech: 'related',
        definition: parsed.related_expressions.join(' · '),
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
