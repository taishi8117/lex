import { providerRegistry } from '@/providers/registry';
import type { DictionaryProvider, LookupResult, LookupOptions as ProviderLookupOptions } from '@/providers/types';
import type { AggregatedResult, SourceLookupResult } from '@/shared/types';
import { TIMEOUTS } from '@/shared/constants';

export interface LookupOptions {
  language?: string;
  timeout?: number;
  signal?: AbortSignal;
  /** Surrounding text context for AI-powered providers */
  context?: string;
}

/**
 * Service that orchestrates parallel lookups across all enabled providers.
 */
class LookupServiceImpl {
  /**
   * Perform lookups across all enabled providers in parallel.
   * Returns aggregated results as sources complete.
   */
  async lookup(word: string, options: LookupOptions = {}): Promise<AggregatedResult> {
    const startTime = performance.now();
    const normalizedWord = word.trim().toLowerCase();
    const timeout = options.timeout ?? TIMEOUTS.LOOKUP;

    const providers = providerRegistry
      .getEnabledProviders()
      .filter((p) => !options.language || p.supportsLanguage(options.language));

    if (providers.length === 0) {
      return {
        word: normalizedWord,
        results: [],
        totalDuration: performance.now() - startTime,
      };
    }

    // Execute all lookups in parallel
    const lookupPromises = providers.map((provider) =>
      this.lookupWithTimeout(provider, normalizedWord, timeout, options.signal, options.context)
    );

    // Use allSettled to ensure all results are collected even if some fail
    const settledResults = await Promise.allSettled(lookupPromises);

    const results: SourceLookupResult[] = settledResults
      .filter(
        (r): r is PromiseFulfilledResult<SourceLookupResult> => r.status === 'fulfilled'
      )
      .map((r) => r.value);

    return {
      word: normalizedWord,
      results,
      totalDuration: performance.now() - startTime,
    };
  }

  /**
   * Perform lookups with streaming results (yields results as they complete).
   * Useful for progressive rendering in the UI.
   */
  async *lookupStreaming(
    word: string,
    options: LookupOptions = {}
  ): AsyncGenerator<SourceLookupResult> {
    const normalizedWord = word.trim().toLowerCase();
    const timeout = options.timeout ?? TIMEOUTS.LOOKUP;

    const providers = providerRegistry
      .getEnabledProviders()
      .filter((p) => !options.language || p.supportsLanguage(options.language));

    if (providers.length === 0) {
      return;
    }

    // Create promises that resolve to their results
    const pending = new Map<
      string,
      Promise<{ id: string; result: SourceLookupResult }>
    >();

    for (const provider of providers) {
      const promise = this.lookupWithTimeout(
        provider,
        normalizedWord,
        timeout,
        options.signal,
        options.context
      ).then((result) => ({ id: provider.metadata.id, result }));

      pending.set(provider.metadata.id, promise);
    }

    // Yield results as they complete (fastest first)
    while (pending.size > 0) {
      try {
        const { id, result } = await Promise.race(pending.values());
        pending.delete(id);
        yield result;
      } catch {
        // If a promise rejects unexpectedly, continue with remaining
        break;
      }
    }
  }

  /**
   * Lookup a single word with a specific provider.
   */
  async lookupSingle(
    providerId: string,
    word: string,
    options: LookupOptions = {}
  ): Promise<SourceLookupResult | null> {
    const provider = providerRegistry.getProvider(providerId);
    if (!provider) {
      return null;
    }

    const timeout = options.timeout ?? TIMEOUTS.LOOKUP;
    return this.lookupWithTimeout(provider, word.trim().toLowerCase(), timeout, options.signal, options.context);
  }

  private async lookupWithTimeout(
    provider: DictionaryProvider,
    word: string,
    timeoutMs: number,
    signal?: AbortSignal,
    context?: string
  ): Promise<SourceLookupResult> {
    const startTime = performance.now();
    const { id, name } = provider.metadata;

    try {
      // Create timeout promise
      const timeoutPromise = new Promise<LookupResult>((_, reject) => {
        setTimeout(() => reject(new Error('Timeout')), timeoutMs);
      });

      // Create abort promise if signal provided
      const abortPromise = signal
        ? new Promise<LookupResult>((_, reject) => {
            signal.addEventListener('abort', () => reject(new Error('Aborted')));
          })
        : null;

      // Build provider-specific options
      const providerOptions: ProviderLookupOptions = { context };

      // Race between lookup, timeout, and abort
      const promises: Promise<LookupResult>[] = [
        provider.lookup(word, providerOptions),
        timeoutPromise,
      ];
      if (abortPromise) {
        promises.push(abortPromise);
      }

      const result = await Promise.race(promises);

      return {
        providerId: id,
        providerName: name,
        result,
        duration: performance.now() - startTime,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      const isTimeout = message === 'Timeout';
      const isAborted = message === 'Aborted';

      return {
        providerId: id,
        providerName: name,
        result: {
          success: false,
          error: {
            code: isAborted ? 'API_ERROR' : isTimeout ? 'NETWORK_ERROR' : 'API_ERROR',
            message: isTimeout ? 'Request timed out' : message,
            retryable: !isAborted,
          },
        },
        duration: performance.now() - startTime,
      };
    }
  }
}

export const lookupService = new LookupServiceImpl();
