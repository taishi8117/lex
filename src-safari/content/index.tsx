/**
 * Safari iOS Content Script Entry Point
 *
 * Displays definitions in a bottom sheet when triggered via toolbar button.
 */
import { createRoot, Root } from 'react-dom/client';
import { BottomSheet } from './bottom-sheet';
import { providerRegistry, registerAllProviders } from '@/providers';
// Import CSS as string for shadow DOM injection
import bottomSheetStyles from '@safari/styles/bottom-sheet.css?inline';

// Debug: Log immediately when script loads
console.log('[Lex Safari] Content script FILE LOADED');

// Register all providers on load
registerAllProviders();
console.log('[Lex Safari] Providers registered');

// Enable OpenAI by default for Safari (will show error if no API key)
providerRegistry.updateConfig('openai', { enabled: true });

// Unique ID for our shadow DOM host
const HOST_ID = 'lex-dictionary-host';

// State
let hostElement: HTMLElement | null = null;
let shadowRoot: ShadowRoot | null = null;
let reactRoot: Root | null = null;

/**
 * Initialize the Safari content script.
 */
async function init(): Promise<void> {
  console.log('[Lex Safari] Initializing content script...');

  // Load provider settings from storage
  await providerRegistry.loadFromStorage();

  // Load settings from browser.storage (saved by popup)
  await loadExtensionSettings();

  // Create the shadow DOM host element
  createHostElement();

  // Listen for messages from background script
  setupMessageListener();

  console.log('[Lex Safari] Content script initialized');
}

/**
 * Load settings from browser.storage (saved by popup).
 */
async function loadExtensionSettings(): Promise<void> {
  try {
    const browser = (globalThis as typeof globalThis & { browser?: typeof chrome }).browser;
    if (!browser?.storage?.local) {
      console.log('[Lex Safari] Browser storage not available');
      return;
    }

    const result = await browser.storage.local.get('lex_extension_settings');
    const settings = result?.lex_extension_settings as {
      providers?: Record<string, boolean>;
      apiKeys?: { openai?: string; mwCollegiate?: string; mwLearners?: string };
    } | undefined;

    console.log('[Lex Safari] Loaded extension settings:', settings);

    if (settings) {
      // Apply provider enabled/disabled settings
      if (settings.providers) {
        for (const [providerId, enabled] of Object.entries(settings.providers)) {
          providerRegistry.updateConfig(providerId, { enabled });
          console.log(`[Lex Safari] Provider ${providerId}: ${enabled ? 'enabled' : 'disabled'}`);
        }
      }

      // Configure OpenAI provider with API key
      if (settings.apiKeys?.openai) {
        const openAIEnabled = settings.providers?.['openai'] ?? false;
        providerRegistry.updateConfig('openai', {
          enabled: openAIEnabled,
          config: { apiKey: settings.apiKeys.openai }
        });
        console.log('[Lex Safari] OpenAI configured, enabled:', openAIEnabled);
      }

      // Configure MW Collegiate with its API key
      if (settings.apiKeys?.mwCollegiate) {
        providerRegistry.updateConfig('mw-collegiate', {
          enabled: settings.providers?.['mw-collegiate'] ?? false,
          config: { apiKey: settings.apiKeys.mwCollegiate }
        });
        console.log('[Lex Safari] MW Collegiate configured');
      }

      // Configure MW Learner's with its API key
      if (settings.apiKeys?.mwLearners) {
        providerRegistry.updateConfig('mw-learners', {
          enabled: settings.providers?.['mw-learners'] ?? false,
          config: { apiKey: settings.apiKeys.mwLearners }
        });
        console.log('[Lex Safari] MW Learners configured');
      }
    } else {
      console.log('[Lex Safari] No settings found, using defaults');
    }
  } catch (error) {
    console.error('[Lex Safari] Failed to load settings:', error);
  }
}

/**
 * Create the shadow DOM host element for the bottom sheet.
 */
function createHostElement(): void {
  // Check if already created
  if (document.getElementById(HOST_ID)) {
    hostElement = document.getElementById(HOST_ID);
    shadowRoot = hostElement?.shadowRoot || null;
    return;
  }

  hostElement = document.createElement('div');
  hostElement.id = HOST_ID;

  // Make sure it doesn't interfere with page content
  hostElement.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    z-index: 2147483647;
    pointer-events: none;
  `;

  document.body.appendChild(hostElement);

  // Create closed shadow root for style isolation
  shadowRoot = hostElement.attachShadow({ mode: 'closed' });

  // Inject styles into shadow DOM
  const styleSheet = document.createElement('style');
  styleSheet.textContent = getStylesContent();
  shadowRoot.appendChild(styleSheet);

  // Create a container for React
  const container = document.createElement('div');
  container.id = 'lex-container';
  container.style.pointerEvents = 'auto';
  shadowRoot.appendChild(container);

  reactRoot = createRoot(container);
}

/**
 * Show the bottom sheet with definitions.
 */
function showBottomSheet(word: string, context?: string): void {
  if (!reactRoot || !hostElement) return;

  // Clear the text selection to remove the ugly overlay
  window.getSelection()?.removeAllRanges();

  hostElement.style.pointerEvents = 'auto';

  reactRoot.render(
    <BottomSheet word={word} context={context} onClose={hideBottomSheet} />
  );
}

/**
 * Hide the bottom sheet.
 */
function hideBottomSheet(): void {
  if (!reactRoot || !hostElement) return;

  hostElement.style.pointerEvents = 'none';

  reactRoot.render(null);
}

/**
 * Get the currently selected text on the page.
 */
function getSelectedText(): string {
  const selection = window.getSelection();
  return selection?.toString().trim() || '';
}

/**
 * Get context around the selected text.
 */
function getSelectionContext(): string | undefined {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return undefined;

  const range = selection.getRangeAt(0);
  const container = range.commonAncestorContainer;
  const textNode = container.nodeType === Node.TEXT_NODE ? container : container.textContent;

  if (!textNode) return undefined;

  const fullText = typeof textNode === 'string' ? textNode : (textNode as Text).textContent || '';
  // Limit context to 500 chars
  return fullText.slice(0, 500);
}

/**
 * Set up message listener for communication with background script.
 */
function setupMessageListener(): void {
  // Safari uses browser.runtime.onMessage
  const browserRuntime = (globalThis as typeof globalThis & {
    browser?: { runtime?: typeof chrome.runtime };
  }).browser?.runtime;

  console.log('[Lex Safari] Setting up message listener, browserRuntime:', !!browserRuntime);

  if (browserRuntime?.onMessage) {
    console.log('[Lex Safari] Adding message listener');
    browserRuntime.onMessage.addListener((message: unknown, _sender: unknown, sendResponse: (response: unknown) => void) => {
      const msg = message as { type?: string; word?: string; context?: string };
      console.log('[Lex Safari] Received message:', msg);

      if (msg.type === 'GET_SELECTED_TEXT') {
        // Return the currently selected text
        const selectedText = getSelectedText();
        const context = getSelectionContext();
        console.log('[Lex Safari] Selected text:', selectedText);
        sendResponse({ selectedText, context });
        return;
      }

      if (msg.type === 'LOOKUP_WORD') {
        console.log('[Lex Safari] Looking up word:', msg.word || '(no word - showing settings)');
        showBottomSheet(msg.word || '', msg.context);
        sendResponse({ success: true });
        return;
      }

      sendResponse({ success: false });
    });
  } else {
    console.error('[Lex Safari] browserRuntime.onMessage not available!');
  }
}

/**
 * Get the CSS content for injection into shadow DOM.
 * Uses the imported CSS file directly.
 */
function getStylesContent(): string {
  return bottomSheetStyles;
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
