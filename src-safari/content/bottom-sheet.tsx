import React, { useEffect, useRef, useState } from 'react';
import { Accordion, AccordionSection } from '@/content/components/Accordion';
import { DefinitionCard, ErrorDisplay } from '@/content/components/DefinitionCard';
import { AccordionSkeleton } from '@/content/components/LoadingSkeleton';
import { useLookup } from '@/content/hooks/useLookup';
import { providerRegistry } from '@/providers/registry';

interface BottomSheetProps {
  word: string;
  context?: string;
  onClose: () => void;
}

/**
 * Bottom sheet component for iOS Safari.
 * Displays dictionary definitions in a slide-up panel.
 */
export function BottomSheet({ word, context, onClose }: BottomSheetProps) {
  const sheetRef = useRef<HTMLDivElement>(null);
  const [translateY, setTranslateY] = useState(100); // Start off-screen (percentage)
  const [isDragging, setIsDragging] = useState(false);
  const dragStartY = useRef(0);
  const sheetHeight = useRef(0);

  // Use the shared lookup hook
  const { results, loading, loadingIds, handleRetry } = useLookup({ word, context });

  // Animate in on mount
  useEffect(() => {
    // Small delay to trigger CSS transition
    const timeoutId = setTimeout(() => {
      setTranslateY(0);
    }, 50);
    return () => clearTimeout(timeoutId);
  }, []);

  // Get sheet height on mount
  useEffect(() => {
    if (sheetRef.current) {
      sheetHeight.current = sheetRef.current.offsetHeight;
    }
  }, [results]);

  const handleClose = () => {
    // Animate out
    setTranslateY(100);
    setTimeout(onClose, 300); // Wait for animation
  };

  // Handle drag to dismiss
  const handleTouchStart = (e: React.TouchEvent) => {
    const target = e.target as HTMLElement;
    // Only allow dragging from the handle area
    if (!target.closest('.lex-bottom-sheet-handle')) return;

    setIsDragging(true);
    dragStartY.current = e.touches[0].clientY;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging) return;

    const deltaY = e.touches[0].clientY - dragStartY.current;
    // Only allow dragging down (positive delta)
    if (deltaY > 0) {
      const percentage = (deltaY / (sheetHeight.current || 500)) * 100;
      setTranslateY(Math.min(percentage, 100));
    }
  };

  const handleTouchEnd = () => {
    if (!isDragging) return;
    setIsDragging(false);

    // If dragged more than 25%, dismiss
    if (translateY > 25) {
      handleClose();
    } else {
      // Snap back
      setTranslateY(0);
    }
  };

  // Handle backdrop tap
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      handleClose();
    }
  };

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  // AI provider handling
  const aiProviderId = 'openai';
  const aiRegistration = providerRegistry.getRegistration(aiProviderId);
  const isAiEnabled = aiRegistration?.enabled ?? false;
  const isAiLoading = loadingIds.has(aiProviderId);
  const aiResult = results?.results.find((r) => r.providerId === aiProviderId);

  // Filter and sort results
  const visibleResults =
    results?.results
      .filter((r) => {
        if (r.providerId === aiProviderId) return false;
        return r.result.success && r.result.data.definitions.length > 0;
      })
      .sort((a, b) => {
        const orderA = providerRegistry.getRegistration(a.providerId)?.order ?? 999;
        const orderB = providerRegistry.getRegistration(b.providerId)?.order ?? 999;
        return orderA - orderB;
      }) || [];

  // Build display items
  type DisplayItem =
    | { type: 'result'; data: typeof visibleResults[0] }
    | { type: 'ai-loading' }
    | { type: 'ai-error'; error: string }
    | { type: 'ai-result'; data: typeof visibleResults[0] };

  const displayItems: DisplayItem[] = [];

  for (const r of visibleResults) {
    displayItems.push({ type: 'result', data: r });
  }

  if (isAiEnabled) {
    if (isAiLoading) {
      displayItems.push({ type: 'ai-loading' });
    } else if (aiResult) {
      if (aiResult.result.success && aiResult.result.data.definitions.length > 0) {
        displayItems.push({ type: 'ai-result', data: aiResult });
      } else if (!aiResult.result.success) {
        displayItems.push({ type: 'ai-error', error: aiResult.result.error.message });
      }
    }
  }

  // Sort by provider order
  const getItemOrder = (item: DisplayItem): number => {
    if (item.type === 'result' || item.type === 'ai-result') {
      return providerRegistry.getRegistration(item.data.providerId)?.order ?? 999;
    }
    return aiRegistration?.order ?? 999;
  };
  displayItems.sort((a, b) => getItemOrder(a) - getItemOrder(b));

  const failedResults =
    results?.results.filter(
      (r) => r.providerId !== aiProviderId && !r.result.success && r.result.error.retryable
    ) || [];

  const allProvidersLoaded = loadingIds.size === 0;
  const hasVisibleContent = displayItems.length > 0;
  const noResults = allProvidersLoaded && !hasVisibleContent;

  return (
    <div
      className="lex-bottom-sheet-backdrop"
      onClick={handleBackdropClick}
      style={{ opacity: 1 - translateY / 200 }}
    >
      <div
        ref={sheetRef}
        className={`lex-bottom-sheet ${isDragging ? 'lex-bottom-sheet--dragging' : ''}`}
        style={{
          transform: `translateY(${translateY}%)`,
          transition: isDragging ? 'none' : 'transform 0.3s ease-out',
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        role="dialog"
        aria-label="Dictionary definitions"
      >
        {/* Drag handle */}
        <div className="lex-bottom-sheet-handle">
          <div className="lex-bottom-sheet-handle-bar" />
        </div>

        {/* Header */}
        <header className="lex-bottom-sheet-header">
          <h2 className="lex-bottom-sheet-word">{word}</h2>
          <button
            className="lex-bottom-sheet-close"
            onClick={handleClose}
            aria-label="Close"
            title="Close"
          >
            <CloseIcon />
          </button>
        </header>

        {/* Content */}
        <div className="lex-bottom-sheet-content">
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

          {/* Loading indicators for pending sources */}
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
    </div>
  );
}

function CloseIcon() {
  return (
    <svg
      width="20"
      height="20"
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
