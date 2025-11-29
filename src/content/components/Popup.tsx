import React, { useEffect, useState, useCallback } from 'react';
import { Accordion, AccordionSection } from './Accordion';
import { DefinitionCard, ErrorDisplay } from './DefinitionCard';
import { AccordionSkeleton } from './LoadingSkeleton';
import { lookupService } from '@/services/lookup-service';
import { providerRegistry } from '@/providers/registry';
import type { AggregatedResult, SourceLookupResult } from '@/shared/types';

interface PopupProps {
  word: string;
  position: { x: number; y: number };
  onClose: () => void;
}

export function Popup({ word, position, onClose }: PopupProps) {
  const [results, setResults] = useState<AggregatedResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingIds, setLoadingIds] = useState<Set<string>>(new Set());

  // Calculate position styles
  const positionStyle: React.CSSProperties = {
    position: 'fixed',
    left: `${position.x}px`,
    top: `${position.y}px`,
    transform: 'translateX(-50%)',
  };

  // Fetch definitions on mount
  useEffect(() => {
    let cancelled = false;
    const abortController = new AbortController();

    const fetchDefinitions = async () => {
      // Get list of enabled providers for loading state
      const enabledProviders = providerRegistry.getEnabledProviders();
      setLoadingIds(new Set(enabledProviders.map((p) => p.metadata.id)));

      try {
        // Use streaming for progressive rendering
        const streamResults: SourceLookupResult[] = [];

        for await (const result of lookupService.lookupStreaming(word, {
          signal: abortController.signal,
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
      } catch (error) {
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
  }, [word]);

  // Handle click outside to close
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      // Check if click is outside by seeing if it's on the main document
      // (not inside our shadow DOM popup)
      const isOutsideClick = !target.closest('#lex-dictionary-host');
      if (isOutsideClick) {
        onClose();
      }
    };

    // Handle escape key
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    // Delay adding listeners to prevent immediate close from the double-click
    const timeoutId = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }, 200);

    return () => {
      clearTimeout(timeoutId);
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  const handleRetry = useCallback(
    async (providerId: string) => {
      setLoadingIds((prev) => new Set(prev).add(providerId));

      const result = await lookupService.lookupSingle(providerId, word);

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
    [word]
  );

  // Filter out sources with no results
  const visibleResults =
    results?.results.filter(
      (r) => r.result.success && r.result.data.definitions.length > 0
    ) || [];

  // Get failed results for potential retry
  const failedResults =
    results?.results.filter((r) => !r.result.success && r.result.error.retryable) || [];

  const allProvidersLoaded = loadingIds.size === 0;
  const noResults = allProvidersLoaded && visibleResults.length === 0;

  return (
    <div className="lex-popup" style={positionStyle} role="dialog" aria-label="Dictionary definitions">
      {/* Header */}
      <header className="lex-popup-header">
        <h2 className="lex-popup-word">{word}</h2>
        <button
          className="lex-popup-close"
          onClick={onClose}
          aria-label="Close"
          title="Close (Esc)"
        >
          <CloseIcon />
        </button>
      </header>

      {/* Content */}
      <div className="lex-popup-content">
        {loading && visibleResults.length === 0 && <AccordionSkeleton count={3} />}

        {noResults && (
          <div className="lex-no-results">
            <p>No definitions found for "{word}"</p>
            {failedResults.length > 0 && (
              <p className="lex-no-results-hint">
                Some sources failed to load.{' '}
                <button
                  className="lex-retry-all"
                  onClick={() => failedResults.forEach((r) => handleRetry(r.providerId))}
                >
                  Retry all
                </button>
              </p>
            )}
          </div>
        )}

        {visibleResults.length > 0 && (
          <Accordion>
            {visibleResults.map((sourceResult, index) => (
              <AccordionSection
                key={sourceResult.providerId}
                id={sourceResult.providerId}
                title={sourceResult.providerName}
                subtitle={
                  sourceResult.result.success
                    ? `${sourceResult.result.data.definitions.length} definitions`
                    : undefined
                }
                loading={loadingIds.has(sourceResult.providerId)}
                defaultExpanded={index === 0}
              >
                {sourceResult.result.success ? (
                  <DefinitionCard result={sourceResult.result.data} />
                ) : (
                  <ErrorDisplay
                    message={sourceResult.result.error.message}
                    retryable={sourceResult.result.error.retryable}
                    onRetry={() => handleRetry(sourceResult.providerId)}
                  />
                )}
              </AccordionSection>
            ))}
          </Accordion>
        )}

        {/* Show loading indicators for still-pending sources */}
        {loadingIds.size > 0 && visibleResults.length > 0 && (
          <div className="lex-pending-sources">
            {Array.from(loadingIds).map((id) => {
              const provider = providerRegistry.getProvider(id);
              return provider ? (
                <span key={id} className="lex-pending-source">
                  <span className="lex-spinner-small" /> {provider.metadata.name}
                </span>
              ) : null;
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function CloseIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        d="M18 6L6 18M6 6L18 18"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
