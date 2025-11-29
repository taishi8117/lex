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
  context?: string;
  onClose: () => void;
}

export function Popup({ word, position, context, onClose }: PopupProps) {
  const [results, setResults] = useState<AggregatedResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingIds, setLoadingIds] = useState<Set<string>>(new Set());
  const [popupPos, setPopupPos] = useState({ x: position.x, y: position.y });
  const [isDragging, setIsDragging] = useState(false);
  const dragOffset = React.useRef({ x: 0, y: 0 });

  // Drag handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('.lex-popup-close')) return;
    setIsDragging(true);
    dragOffset.current = {
      x: e.clientX - popupPos.x,
      y: e.clientY - popupPos.y,
    };
    e.preventDefault();
  };

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      setPopupPos({
        x: e.clientX - dragOffset.current.x,
        y: e.clientY - dragOffset.current.y,
      });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging]);

  // Calculate position styles
  const positionStyle: React.CSSProperties = {
    position: 'fixed',
    left: `${popupPos.x}px`,
    top: `${popupPos.y}px`,
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
  }, [word, context]);

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

  // Check if AI provider is enabled
  const aiProviderId = 'openai';
  const aiRegistration = providerRegistry.getRegistration(aiProviderId);
  const isAiEnabled = aiRegistration?.enabled ?? false;
  const isAiLoading = loadingIds.has(aiProviderId);
  const aiResult = results?.results.find((r) => r.providerId === aiProviderId);

  // Filter out sources with no results, then sort by configured order
  // AI provider is handled separately and always shown when enabled
  const visibleResults =
    results?.results
      .filter((r) => {
        // AI is always shown separately when enabled
        if (r.providerId === aiProviderId) return false;
        return r.result.success && r.result.data.definitions.length > 0;
      })
      .sort((a, b) => {
        const orderA = providerRegistry.getRegistration(a.providerId)?.order ?? 999;
        const orderB = providerRegistry.getRegistration(b.providerId)?.order ?? 999;
        return orderA - orderB;
      }) || [];

  // Build display items: regular results + AI slot (if enabled)
  type DisplayItem =
    | { type: 'result'; data: SourceLookupResult }
    | { type: 'ai-loading' }
    | { type: 'ai-error'; error: string }
    | { type: 'ai-result'; data: SourceLookupResult };

  const displayItems: DisplayItem[] = [];

  // Add regular results
  for (const r of visibleResults) {
    displayItems.push({ type: 'result', data: r });
  }

  // Add AI item if enabled
  if (isAiEnabled) {
    if (isAiLoading) {
      displayItems.push({ type: 'ai-loading' });
    } else if (aiResult) {
      if (aiResult.result.success && aiResult.result.data.definitions.length > 0) {
        displayItems.push({ type: 'ai-result', data: aiResult });
      } else if (!aiResult.result.success) {
        displayItems.push({ type: 'ai-error', error: aiResult.result.error.message });
      }
      // If success but no definitions, don't show anything
    }
  }

  // Sort all display items by provider order
  const getItemOrder = (item: DisplayItem): number => {
    if (item.type === 'result') {
      return providerRegistry.getRegistration(item.data.providerId)?.order ?? 999;
    }
    // AI items use the AI provider order
    return aiRegistration?.order ?? 999;
  };
  displayItems.sort((a, b) => getItemOrder(a) - getItemOrder(b));

  // Get failed results for potential retry (excluding AI which is handled separately)
  const failedResults =
    results?.results.filter(
      (r) => r.providerId !== aiProviderId && !r.result.success && r.result.error.retryable
    ) || [];

  const allProvidersLoaded = loadingIds.size === 0;
  const hasVisibleContent = displayItems.length > 0;
  const noResults = allProvidersLoaded && !hasVisibleContent;

  return (
    <div className={`lex-popup ${isDragging ? 'lex-popup--dragging' : ''}`} style={positionStyle} role="dialog" aria-label="Dictionary definitions">
      {/* Header - draggable */}
      <header className="lex-popup-header" onMouseDown={handleMouseDown}>
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
        {loading && !hasVisibleContent && <AccordionSkeleton count={3} />}

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

        {hasVisibleContent && (
          <Accordion>
            {displayItems.map((item) => {
              if (item.type === 'result' || item.type === 'ai-result') {
                const sourceResult = item.data;
                if (!sourceResult.result.success) return null;
                return (
                  <AccordionSection
                    key={sourceResult.providerId}
                    id={sourceResult.providerId}
                    title={sourceResult.providerName}
                    loading={false}
                    defaultExpanded={true}
                  >
                    <DefinitionCard result={sourceResult.result.data} />
                  </AccordionSection>
                );
              }

              if (item.type === 'ai-loading') {
                const aiProvider = providerRegistry.getProvider(aiProviderId);
                return (
                  <AccordionSection
                    key={aiProviderId}
                    id={aiProviderId}
                    title={aiProvider?.metadata.name || 'AI Analysis'}
                    loading={true}
                    defaultExpanded={true}
                  >
                    <div className="lex-ai-loading">
                      <span className="lex-spinner-small" /> Analyzing...
                    </div>
                  </AccordionSection>
                );
              }

              if (item.type === 'ai-error') {
                const aiProvider = providerRegistry.getProvider(aiProviderId);
                return (
                  <AccordionSection
                    key={aiProviderId}
                    id={aiProviderId}
                    title={aiProvider?.metadata.name || 'AI Analysis'}
                    loading={false}
                    defaultExpanded={true}
                  >
                    <ErrorDisplay
                      message={item.error}
                      retryable={true}
                      onRetry={() => handleRetry(aiProviderId)}
                    />
                  </AccordionSection>
                );
              }

              return null;
            })}
          </Accordion>
        )}

        {/* Show loading indicators for still-pending sources (excluding AI which shows inline) */}
        {loadingIds.size > 0 && hasVisibleContent && (
          <div className="lex-pending-sources">
            {Array.from(loadingIds)
              .filter((id) => id !== aiProviderId)
              .map((id) => {
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
