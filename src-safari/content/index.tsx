/**
 * Safari iOS Content Script Entry Point
 *
 * Handles word selection via long-press and displays definitions in a bottom sheet.
 */
import { createRoot, Root } from 'react-dom/client';
import { LongPressHandler, LongPressResult } from './long-press-handler';
import { BottomSheet } from './bottom-sheet';
import { providerRegistry } from '@/providers/registry';
import '@/providers'; // Register all providers
import '@safari/styles/bottom-sheet.css';

// Unique ID for our shadow DOM host
const HOST_ID = 'lex-dictionary-host';

// State
let hostElement: HTMLElement | null = null;
let shadowRoot: ShadowRoot | null = null;
let reactRoot: Root | null = null;
let longPressHandler: LongPressHandler | null = null;
let isBottomSheetVisible = false;

/**
 * Initialize the Safari content script.
 */
async function init(): Promise<void> {
  console.log('[Lex Safari] Initializing content script...');

  // Load provider settings from storage
  await providerRegistry.loadFromStorage();

  // Create the shadow DOM host element
  createHostElement();

  // Set up long-press detection
  setupLongPressHandler();

  // Listen for messages from background script (Share Sheet)
  setupMessageListener();

  console.log('[Lex Safari] Content script initialized');
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
 * Set up the long-press handler.
 */
function setupLongPressHandler(): void {
  longPressHandler = new LongPressHandler(handleWordSelection);
  longPressHandler.attach();
}

/**
 * Handle word selection from long-press.
 */
function handleWordSelection(result: LongPressResult): void {
  if (isBottomSheetVisible) {
    // Close existing bottom sheet first
    hideBottomSheet();
    // Small delay before showing new one
    setTimeout(() => {
      showBottomSheet(result.word, result.context);
    }, 100);
  } else {
    showBottomSheet(result.word, result.context);
  }
}

/**
 * Show the bottom sheet with definitions.
 */
function showBottomSheet(word: string, context?: string): void {
  if (!reactRoot || !hostElement) return;

  isBottomSheetVisible = true;
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

  isBottomSheetVisible = false;
  hostElement.style.pointerEvents = 'none';

  reactRoot.render(null);
}

/**
 * Set up message listener for communication with background script.
 * Used for Share Sheet integration.
 */
function setupMessageListener(): void {
  // Safari uses browser.runtime.onMessage
  const browserRuntime = (globalThis as typeof globalThis & {
    browser?: { runtime?: typeof chrome.runtime };
  }).browser?.runtime;

  if (browserRuntime?.onMessage) {
    browserRuntime.onMessage.addListener((message: unknown) => {
      const msg = message as { type?: string; word?: string; context?: string };
      if (msg.type === 'LOOKUP_WORD' && msg.word) {
        showBottomSheet(msg.word, msg.context);
      }
    });
  }
}

/**
 * Get the CSS content for injection into shadow DOM.
 * In production, this would be bundled by Vite.
 */
function getStylesContent(): string {
  // This will be replaced by actual CSS content during build
  // For now, return a placeholder that loads from the bundled CSS
  return `
    /* Bottom Sheet Styles for iOS Safari */
    :host {
      --lex-bg-primary: #ffffff;
      --lex-bg-secondary: #f8f9fa;
      --lex-bg-hover: #e9ecef;
      --lex-text-primary: #212529;
      --lex-text-secondary: #6c757d;
      --lex-text-muted: #adb5bd;
      --lex-border: #dee2e6;
      --lex-accent: #0066cc;
      --lex-accent-hover: #0052a3;
      --lex-error: #dc3545;
      --lex-success: #28a745;
      --lex-space-xs: 2px;
      --lex-space-sm: 4px;
      --lex-space-md: 8px;
      --lex-space-lg: 12px;
      --lex-space-xl: 16px;
      --lex-font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      --lex-font-size-xs: 11px;
      --lex-font-size-sm: 12px;
      --lex-font-size-base: 14px;
      --lex-font-size-lg: 16px;
      --lex-font-size-xl: 18px;
      --lex-transition-fast: 150ms ease-out;
      --lex-transition-normal: 300ms ease-out;
      --lex-shadow-lg: 0 -4px 20px rgba(0, 0, 0, 0.15);
    }

    @media (prefers-color-scheme: dark) {
      :host {
        --lex-bg-primary: #1e1e1e;
        --lex-bg-secondary: #2d2d2d;
        --lex-bg-hover: #3d3d3d;
        --lex-text-primary: #e4e4e4;
        --lex-text-secondary: #a0a0a0;
        --lex-text-muted: #6b6b6b;
        --lex-border: #404040;
        --lex-accent: #58a6ff;
        --lex-accent-hover: #79b8ff;
        --lex-shadow-lg: 0 -4px 20px rgba(0, 0, 0, 0.5);
      }
    }

    *, *::before, *::after {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    .lex-bottom-sheet-backdrop {
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.4);
      z-index: 2147483646;
      transition: opacity var(--lex-transition-normal);
    }

    .lex-bottom-sheet {
      position: fixed;
      bottom: 0;
      left: 0;
      right: 0;
      max-height: 70vh;
      background: var(--lex-bg-primary);
      border-radius: 16px 16px 0 0;
      box-shadow: var(--lex-shadow-lg);
      z-index: 2147483647;
      display: flex;
      flex-direction: column;
      overflow: hidden;
      font-family: var(--lex-font-family);
      font-size: var(--lex-font-size-base);
      color: var(--lex-text-primary);
      padding-bottom: env(safe-area-inset-bottom, 0);
    }

    .lex-bottom-sheet--dragging {
      user-select: none;
    }

    .lex-bottom-sheet-handle {
      display: flex;
      justify-content: center;
      padding: var(--lex-space-lg);
      cursor: grab;
      touch-action: none;
    }

    .lex-bottom-sheet-handle-bar {
      width: 36px;
      height: 5px;
      background: var(--lex-border);
      border-radius: 3px;
    }

    .lex-bottom-sheet-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 var(--lex-space-xl) var(--lex-space-md);
      border-bottom: 1px solid var(--lex-border);
    }

    .lex-bottom-sheet-word {
      font-size: var(--lex-font-size-xl);
      font-weight: 600;
      margin: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .lex-bottom-sheet-close {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 32px;
      height: 32px;
      border: none;
      border-radius: 50%;
      background: var(--lex-bg-secondary);
      color: var(--lex-text-secondary);
      cursor: pointer;
      -webkit-tap-highlight-color: transparent;
    }

    .lex-bottom-sheet-content {
      flex: 1;
      overflow-y: auto;
      padding: var(--lex-space-md);
      -webkit-overflow-scrolling: touch;
    }

    /* Additional styles would be included here from bottom-sheet.css */
  `;
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
