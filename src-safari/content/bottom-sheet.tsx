import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Accordion, AccordionSection } from '@/content/components/Accordion';
import { DefinitionCard, ErrorDisplay } from '@/content/components/DefinitionCard';
import { AccordionSkeleton } from '@/content/components/LoadingSkeleton';
import { useLookup } from '@/content/hooks/useLookup';
import { providerRegistry } from '@/providers/registry';

// Settings interface
interface LexSettings {
  providers: Record<string, boolean>;
  providerOrder: string[];
  apiKeys: {
    openai: string;
    mwCollegiate: string;
    mwLearners: string;
  };
}

const DEFAULT_PROVIDER_ORDER = [
  'free-dictionary',
  'mw-collegiate',
  'mw-learners',
  'wikipedia',
  'urban-dictionary',
  'jisho',
  'openai',
];

const DEFAULT_SETTINGS: LexSettings = {
  providers: {
    'free-dictionary': true,
    'wikipedia': true,
    'urban-dictionary': true,
    'jisho': false,
    'openai': false,
    'mw-collegiate': false,
    'mw-learners': false,
  },
  providerOrder: DEFAULT_PROVIDER_ORDER,
  apiKeys: {
    openai: '',
    mwCollegiate: '',
    mwLearners: '',
  },
};

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
  const [isExpanded, setIsExpanded] = useState(false); // Full height mode
  const [showSettings, setShowSettings] = useState(!word); // Show settings if no word selected
  const [sectionStates, setSectionStates] = useState<Record<string, boolean>>({}); // Individual section states
  const [settings, setSettings] = useState<LexSettings>(DEFAULT_SETTINGS);
  const dragStartY = useRef(0);
  const dragStartExpanded = useRef(false);
  const sheetHeight = useRef(0);

  // Use the shared lookup hook
  const { results, loading, loadingIds, handleRetry } = useLookup({ word, context });

  // Load settings on mount
  useEffect(() => {
    loadSettings().then(setSettings);
  }, []);

  const loadSettings = async (): Promise<LexSettings> => {
    try {
      const browser = (globalThis as typeof globalThis & { browser?: typeof chrome }).browser;
      if (!browser?.storage?.local) return DEFAULT_SETTINGS;
      const result = await browser.storage.local.get('lex_extension_settings');
      const saved = result.lex_extension_settings;
      if (saved) {
        // Merge with defaults to handle missing fields
        return {
          ...DEFAULT_SETTINGS,
          ...saved,
          providerOrder: saved.providerOrder || DEFAULT_PROVIDER_ORDER,
          apiKeys: { ...DEFAULT_SETTINGS.apiKeys, ...saved.apiKeys },
        };
      }
      return DEFAULT_SETTINGS;
    } catch {
      return DEFAULT_SETTINGS;
    }
  };

  const saveSettings = useCallback(async (newSettings: LexSettings) => {
    try {
      const browser = (globalThis as typeof globalThis & { browser?: typeof chrome }).browser;
      if (!browser?.storage?.local) return;
      await browser.storage.local.set({ lex_extension_settings: newSettings });
      setSettings(newSettings);

      // Apply settings to provider registry
      Object.entries(newSettings.providers).forEach(([id, enabled]) => {
        providerRegistry.updateConfig(id, { enabled });
      });
      if (newSettings.apiKeys.openai) {
        providerRegistry.updateConfig('openai', { config: { apiKey: newSettings.apiKeys.openai } });
      }
      if (newSettings.apiKeys.mwCollegiate) {
        providerRegistry.updateConfig('mw-collegiate', { config: { apiKey: newSettings.apiKeys.mwCollegiate } });
      }
      if (newSettings.apiKeys.mwLearners) {
        providerRegistry.updateConfig('mw-learners', { config: { apiKey: newSettings.apiKeys.mwLearners } });
      }
    } catch (e) {
      console.error('[Lex] Failed to save settings:', e);
    }
  }, []);

  // Section expand/collapse helpers
  const isSectionExpanded = (id: string) => sectionStates[id] ?? true; // Default expanded
  const toggleSection = (id: string) => {
    setSectionStates(prev => ({ ...prev, [id]: !isSectionExpanded(id) }));
  };

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

  // Handle drag to expand/collapse/dismiss (only from handle area)
  const handleTouchStart = (e: React.TouchEvent) => {
    const target = e.target as HTMLElement;
    // Only allow dragging from the handle area
    if (!target.closest('.lex-bottom-sheet-handle')) return;

    e.preventDefault(); // Prevent page scroll
    setIsDragging(true);
    dragStartY.current = e.touches[0].clientY;
    dragStartExpanded.current = isExpanded;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging) return;
    e.preventDefault(); // Prevent page scroll while dragging

    const deltaY = e.touches[0].clientY - dragStartY.current;

    if (dragStartExpanded.current) {
      // If expanded, dragging down collapses
      if (deltaY > 0) {
        const percentage = Math.min((deltaY / 200) * 40, 40);
        setTranslateY(percentage);
      }
    } else {
      // If collapsed, dragging up expands, dragging down dismisses
      if (deltaY < 0) {
        // Dragging up to expand
        const percentage = Math.max((deltaY / 150) * 20, -20);
        setTranslateY(percentage);
      } else if (deltaY > 0) {
        // Dragging down to dismiss
        const percentage = (deltaY / (sheetHeight.current || 400)) * 100;
        setTranslateY(Math.min(percentage, 100));
      }
    }
  };

  const handleTouchEnd = () => {
    if (!isDragging) return;
    setIsDragging(false);

    if (dragStartExpanded.current) {
      // Was expanded - check if should collapse
      if (translateY > 20) {
        setIsExpanded(false);
        setTranslateY(0);
      } else {
        setTranslateY(0);
      }
    } else {
      // Was collapsed
      if (translateY < -10) {
        // Swiped up enough - expand
        setIsExpanded(true);
        setTranslateY(0);
      } else if (translateY > 30) {
        // Swiped down enough - dismiss
        handleClose();
      } else {
        // Snap back
        setTranslateY(0);
      }
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

  // Sort by user-defined provider order from settings
  const getItemOrder = (item: DisplayItem): number => {
    let providerId: string;
    if (item.type === 'result' || item.type === 'ai-result') {
      providerId = item.data.providerId;
    } else {
      providerId = aiProviderId;
    }
    const orderIndex = settings.providerOrder.indexOf(providerId);
    return orderIndex >= 0 ? orderIndex : 999;
  };
  displayItems.sort((a, b) => getItemOrder(a) - getItemOrder(b));

  // Toggle all sections expand/collapse
  const toggleAllSections = () => {
    const providerIds = displayItems.map(item => {
      if (item.type === 'result' || item.type === 'ai-result') return item.data.providerId;
      return aiProviderId;
    });
    // If any section is expanded (or no states set yet = default expanded), collapse all
    const anyExpanded = providerIds.some(id => isSectionExpanded(id));
    const newState: Record<string, boolean> = {};
    providerIds.forEach(id => { newState[id] = !anyExpanded; });
    setSectionStates(newState);
  };
  const allCollapsed = displayItems.length > 0 && displayItems.every(item => {
    const id = (item.type === 'result' || item.type === 'ai-result') ? item.data.providerId : aiProviderId;
    return !isSectionExpanded(id);
  });

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
        className={`lex-bottom-sheet ${isDragging ? 'lex-bottom-sheet--dragging' : ''} ${isExpanded ? 'lex-bottom-sheet--expanded' : ''}`}
        style={{
          transform: `translateY(${translateY}%)`,
          transition: isDragging ? 'none' : 'transform 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94), top 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
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
          <h2 className="lex-bottom-sheet-word">{word || 'Lex Dictionary'}</h2>
          <div className="lex-bottom-sheet-header-actions">
            {!showSettings && hasVisibleContent && (
              <button
                className="lex-header-btn"
                onClick={toggleAllSections}
                aria-label={allCollapsed ? 'Expand all' : 'Collapse all'}
                title={allCollapsed ? 'Expand all' : 'Collapse all'}
              >
                {allCollapsed ? <ExpandAllIcon /> : <CollapseAllIcon />}
              </button>
            )}
            {word && (
              <button
                className={`lex-header-btn ${showSettings ? 'lex-header-btn--active' : ''}`}
                onClick={() => setShowSettings(!showSettings)}
                aria-label="Settings"
              >
                <SettingsIcon />
              </button>
            )}
            <button
              className="lex-header-btn"
              onClick={handleClose}
              aria-label="Close"
            >
              <CloseIcon />
            </button>
          </div>
        </header>

        {/* Settings Panel OR Content */}
        {showSettings ? (
          <SettingsPanel
            settings={settings}
            onSave={saveSettings}
            onClose={() => word ? setShowSettings(false) : handleClose()}
          />
        ) : (
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
                      expanded={isSectionExpanded(sourceResult.providerId)}
                      onToggle={() => toggleSection(sourceResult.providerId)}
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
                      expanded={isSectionExpanded(aiProviderId)}
                      onToggle={() => toggleSection(aiProviderId)}
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
                      expanded={isSectionExpanded(aiProviderId)}
                      onToggle={() => toggleSection(aiProviderId)}
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
        )}
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

function SettingsIcon() {
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
        d="M12 15a3 3 0 100-6 3 3 0 000 6z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ChevronUpIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M18 15l-6-6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ChevronDownIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ExpandAllIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function CollapseAllIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

interface SettingsPanelProps {
  settings: LexSettings;
  onSave: (settings: LexSettings) => void;
  onClose: () => void;
}

function SettingsPanel({ settings, onSave, onClose }: SettingsPanelProps) {
  const [localSettings, setLocalSettings] = useState(settings);

  const handleProviderToggle = (providerId: string, enabled: boolean) => {
    const newSettings = {
      ...localSettings,
      providers: { ...localSettings.providers, [providerId]: enabled },
    };
    setLocalSettings(newSettings);
    onSave(newSettings);
  };

  const handleApiKeyChange = (key: 'openai' | 'mwCollegiate' | 'mwLearners', value: string) => {
    const newSettings = {
      ...localSettings,
      apiKeys: { ...localSettings.apiKeys, [key]: value },
    };
    setLocalSettings(newSettings);
    // Debounce API key saves
    const timeoutId = setTimeout(() => onSave(newSettings), 500);
    return () => clearTimeout(timeoutId);
  };

  const handleMoveProvider = (providerId: string, direction: 'up' | 'down') => {
    const currentOrder = [...localSettings.providerOrder];
    const index = currentOrder.indexOf(providerId);
    if (index === -1) return;

    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= currentOrder.length) return;

    // Swap
    [currentOrder[index], currentOrder[newIndex]] = [currentOrder[newIndex], currentOrder[index]];

    const newSettings = {
      ...localSettings,
      providerOrder: currentOrder,
    };
    setLocalSettings(newSettings);
    onSave(newSettings);
  };

  const allProviders = [
    { id: 'free-dictionary', name: 'Free Dictionary' },
    { id: 'mw-collegiate', name: 'MW Collegiate' },
    { id: 'mw-learners', name: 'MW Learner\'s' },
    { id: 'wikipedia', name: 'Wikipedia' },
    { id: 'urban-dictionary', name: 'Urban Dictionary' },
    { id: 'jisho', name: 'Jisho (Japanese)' },
    { id: 'openai', name: 'AI Analysis' },
  ];

  // Sort providers by current order
  const sortedProviders = [...allProviders].sort((a, b) => {
    const indexA = localSettings.providerOrder.indexOf(a.id);
    const indexB = localSettings.providerOrder.indexOf(b.id);
    return (indexA === -1 ? 999 : indexA) - (indexB === -1 ? 999 : indexB);
  });

  const freeProviders = [
    { id: 'free-dictionary', name: 'Free Dictionary' },
    { id: 'wikipedia', name: 'Wikipedia' },
    { id: 'urban-dictionary', name: 'Urban Dictionary' },
    { id: 'jisho', name: 'Jisho (Japanese)' },
  ];

  return (
    <div className="lex-settings-panel">
      <div className="lex-settings-header">
        <h3>Settings</h3>
        <button className="lex-settings-done" onClick={onClose}>Done</button>
      </div>

      <div className="lex-settings-content">
        <div className="lex-settings-section">
          <h4>Provider Order</h4>
          <div className="lex-provider-list">
            {sortedProviders.map(({ id, name }, index) => (
              <div key={id} className="lex-provider-item">
                <div className="lex-provider-item-handle">
                  <span /><span /><span />
                </div>
                <span className="lex-provider-item-name">{name}</span>
                <div className="lex-provider-item-actions">
                  <button
                    className="lex-provider-move-btn"
                    onClick={() => handleMoveProvider(id, 'up')}
                    disabled={index === 0}
                    aria-label="Move up"
                  >
                    <ChevronUpIcon />
                  </button>
                  <button
                    className="lex-provider-move-btn"
                    onClick={() => handleMoveProvider(id, 'down')}
                    disabled={index === sortedProviders.length - 1}
                    aria-label="Move down"
                  >
                    <ChevronDownIcon />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="lex-settings-section">
          <h4>Free Dictionary Sources</h4>
          {freeProviders.map(({ id, name }) => (
            <label key={id} className="lex-settings-toggle">
              <span>{name}</span>
              <input
                type="checkbox"
                checked={localSettings.providers[id] ?? false}
                onChange={(e) => handleProviderToggle(id, e.target.checked)}
              />
            </label>
          ))}
        </div>

        <div className="lex-settings-section">
          <h4>AI Analysis (OpenAI)</h4>
          <label className="lex-settings-toggle">
            <span>Enable AI Analysis</span>
            <input
              type="checkbox"
              checked={localSettings.providers['openai'] ?? false}
              onChange={(e) => handleProviderToggle('openai', e.target.checked)}
            />
          </label>
          <div className="lex-settings-input-group">
            <label>API Key</label>
            <input
              type="password"
              placeholder="sk-..."
              value={localSettings.apiKeys.openai}
              onChange={(e) => handleApiKeyChange('openai', e.target.value)}
            />
          </div>
        </div>

        <div className="lex-settings-section">
          <h4>Merriam-Webster Collegiate</h4>
          <label className="lex-settings-toggle">
            <span>Enable Collegiate Dictionary</span>
            <input
              type="checkbox"
              checked={localSettings.providers['mw-collegiate'] ?? false}
              onChange={(e) => handleProviderToggle('mw-collegiate', e.target.checked)}
            />
          </label>
          <div className="lex-settings-input-group">
            <label>Collegiate API Key</label>
            <input
              type="password"
              placeholder="Enter Collegiate API key"
              value={localSettings.apiKeys.mwCollegiate}
              onChange={(e) => handleApiKeyChange('mwCollegiate', e.target.value)}
            />
          </div>
        </div>

        <div className="lex-settings-section">
          <h4>Merriam-Webster Learner's</h4>
          <label className="lex-settings-toggle">
            <span>Enable Learner's Dictionary</span>
            <input
              type="checkbox"
              checked={localSettings.providers['mw-learners'] ?? false}
              onChange={(e) => handleProviderToggle('mw-learners', e.target.checked)}
            />
          </label>
          <div className="lex-settings-input-group">
            <label>Learner's API Key</label>
            <input
              type="password"
              placeholder="Enter Learner's API key"
              value={localSettings.apiKeys.mwLearners}
              onChange={(e) => handleApiKeyChange('mwLearners', e.target.value)}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
