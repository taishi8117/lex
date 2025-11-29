import { createRoot, Root } from 'react-dom/client';
import { Popup } from './components/Popup';
import { SelectionHandler, type SelectionResult } from './selection-handler';
import { registerAllProviders, providerRegistry } from '@/providers';
import popupStyles from '../styles/popup.css?inline';

// Popup state
let popupRoot: Root | null = null;
let shadowRoot: ShadowRoot | null = null;
let hostElement: HTMLElement | null = null;
let selectionHandler: SelectionHandler | null = null;

/**
 * Initialize the extension content script.
 */
async function init() {
  // Register all providers
  registerAllProviders();

  // Load saved settings
  await providerRegistry.loadFromStorage();

  // Listen for settings changes (when user updates in options page)
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === 'local' && changes.lex_provider_settings) {
      console.log('[Lex Dictionary] Settings changed, reloading...');
      providerRegistry.loadFromStorage();
    }
  });

  // Create shadow DOM host for style isolation
  createShadowHost();

  // Set up selection handler
  selectionHandler = new SelectionHandler(handleWordSelected);
  selectionHandler.attach();

  // Listen for context menu lookups from background script
  chrome.runtime.onMessage.addListener((message) => {
    if (message.type === 'LOOKUP_SELECTION' && message.text) {
      // Get current mouse position or center of viewport
      const position = getPopupPosition();
      // Capture context from current selection
      const context = selectionHandler?.getSurroundingContext();
      showPopup(message.text, position, context);
    }
  });

  console.log('[Lex Dictionary] Initialized');
}

/**
 * Get position for popup (near selection or center of viewport).
 */
function getPopupPosition(): { x: number; y: number } {
  const selection = window.getSelection();
  if (selection && !selection.isCollapsed) {
    try {
      const range = selection.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      return {
        x: rect.left + rect.width / 2,
        y: rect.bottom + 10,
      };
    } catch {
      // Fall through to default
    }
  }
  // Default to center of viewport
  return {
    x: window.innerWidth / 2,
    y: window.innerHeight / 3,
  };
}

/**
 * Create Shadow DOM host element for popup.
 * This isolates our styles from the host page.
 */
function createShadowHost() {
  hostElement = document.createElement('div');
  hostElement.id = 'lex-dictionary-host';
  hostElement.style.cssText = `
    all: initial;
    position: fixed;
    top: 0;
    left: 0;
    width: 0;
    height: 0;
    z-index: 2147483647;
    pointer-events: none;
  `;

  shadowRoot = hostElement.attachShadow({ mode: 'closed' });

  // Inject styles into shadow DOM
  const styleElement = document.createElement('style');
  styleElement.textContent = popupStyles;
  shadowRoot.appendChild(styleElement);

  // Create container for React
  const container = document.createElement('div');
  container.id = 'lex-popup-container';
  container.style.pointerEvents = 'auto';
  shadowRoot.appendChild(container);

  document.body.appendChild(hostElement);
}

/**
 * Handle word selection from the selection handler.
 */
function handleWordSelected(result: SelectionResult) {
  showPopup(result.text, result.position, result.context);
}

/**
 * Show the popup for a word at the given position.
 */
function showPopup(word: string, position: { x: number; y: number }, context?: string) {
  // Close existing popup first
  hidePopup();

  if (!shadowRoot) {
    console.error('[Lex Dictionary] Shadow root not initialized');
    return;
  }

  const container = shadowRoot.getElementById('lex-popup-container');
  if (!container) {
    console.error('[Lex Dictionary] Popup container not found');
    return;
  }

  // Create React root and render popup
  popupRoot = createRoot(container);
  popupRoot.render(
    <Popup
      word={word}
      position={position}
      context={context}
      onClose={hidePopup}
    />
  );
}

/**
 * Hide and cleanup the popup.
 */
function hidePopup() {
  if (popupRoot) {
    popupRoot.unmount();
    popupRoot = null;
  }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
