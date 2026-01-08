import { useEffect, useState, useCallback } from 'react';
import { lookupService } from '@/services/lookup-service';
import { providerRegistry } from '@/providers/registry';
import type { AggregatedResult, SourceLookupResult } from '@/shared/types';

interface UseLookupOptions {
  word: string;
  context?: string;
}

interface UseLookupResult {
  results: AggregatedResult | null;
  loading: boolean;
  loadingIds: Set<string>;
  handleRetry: (providerId: string) => Promise<void>;
}

/**
 * Custom hook for managing dictionary lookups.
 * Extracts the lookup logic from Popup to be reusable across Chrome and Safari.
 */
export function useLookup({ word, context }: UseLookupOptions): UseLookupResult {
  const [results, setResults] = useState<AggregatedResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingIds, setLoadingIds] = useState<Set<string>>(new Set());

  // Fetch definitions on mount or when word changes
  useEffect(() => {
    let cancelled = false;
    const abortController = new AbortController();

    const fetchDefinitions = async () => {
      // Reset state
      setResults(null);
      setLoading(true);

      // Get list of enabled providers for loading state
      const enabledProviders = providerRegistry.getEnabledProviders();
      setLoadingIds(new Set(enabledProviders.map((p) => p.metadata.id)));

      try {
        // Use streaming for progressive rendering
        const streamResults: SourceLookupResult[] = [];

        for await (const result of lookupService.lookupStreaming(word, {
          signal: abortController.signal,
          context,
        })) {
          if (cancelled) break;

          streamResults.push(result);
          setLoadingIds((prev) => {
            const next = new Set(prev);
            next.delete(result.providerId);
            return next;
          });
          setResults({
            word,
            results: [...streamResults],
            totalDuration: 0,
          });
        }

        if (!cancelled) {
          setLoading(false);
        }
      } catch {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    fetchDefinitions();

    return () => {
      cancelled = true;
      abortController.abort();
    };
  }, [word, context]);

  const handleRetry = useCallback(
    async (providerId: string) => {
      setLoadingIds((prev) => new Set(prev).add(providerId));

      const result = await lookupService.lookupSingle(providerId, word, { context });

      if (result) {
        setResults((prev) => {
          if (!prev) return prev;
          const newResults = prev.results.filter((r) => r.providerId !== providerId);
          newResults.push(result);
          return { ...prev, results: newResults };
        });
      }

      setLoadingIds((prev) => {
        const next = new Set(prev);
        next.delete(providerId);
        return next;
      });
    },
    [word, context]
  );

  return {
    results,
    loading,
    loadingIds,
    handleRetry,
  };
}
