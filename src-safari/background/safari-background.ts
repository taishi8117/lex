/**
 * Safari iOS Background Script
 *
 * Handles communication between the content script and the native iOS app.
 * Note: iOS Safari doesn't support context menus, so this is simpler than Chrome.
 */

// Use WebExtensions browser API (Safari's standard)
const safariRuntime = (globalThis as typeof globalThis & { browser: typeof chrome }).browser;

/**
 * Handle messages from content scripts or native app.
 */
safariRuntime.runtime.onMessage.addListener(
  (
    message: { type: string; word?: string; context?: string; appSettings?: unknown; providerSettings?: unknown },
    _sender: chrome.runtime.MessageSender,
    sendResponse: (response?: unknown) => void
  ) => {
    console.log('[Lex Safari Background] Received message:', message);

    switch (message.type) {
      case 'LOOKUP_WORD':
        // Forward to content script in active tab
        handleLookupWord(message.word || '', message.context);
        sendResponse({ success: true });
        break;

      case 'GET_SETTINGS':
        // Return current settings to native app
        handleGetSettings().then(sendResponse);
        return true; // Keep channel open for async response

      case 'SAVE_SETTINGS':
        // Save settings from native app
        handleSaveSettings(message).then(sendResponse);
        return true;

      default:
        sendResponse({ success: false, error: 'Unknown message type' });
    }
  }
);

/**
 * Handle lookup word request (from Share Sheet via native app).
 */
async function handleLookupWord(word: string, context?: string): Promise<void> {
  if (!word) return;

  try {
    // Get the active tab
    const tabs = await safariRuntime.tabs.query({ active: true, currentWindow: true });
    const activeTab = tabs[0];

    if (activeTab?.id) {
      // Send message to content script
      await safariRuntime.tabs.sendMessage(activeTab.id, {
        type: 'LOOKUP_WORD',
        word,
        context,
      });
    }
  } catch (error) {
    console.error('[Lex Safari Background] Failed to send lookup message:', error);
  }
}

/**
 * Get settings for native app.
 */
async function handleGetSettings(): Promise<{ success: boolean; settings?: unknown }> {
  try {
    const result = await safariRuntime.storage.local.get([
      'lex_settings',
      'lex_provider_settings',
    ]);
    return {
      success: true,
      settings: {
        appSettings: result.lex_settings || {},
        providerSettings: result.lex_provider_settings || {},
      },
    };
  } catch (error) {
    console.error('[Lex Safari Background] Failed to get settings:', error);
    return { success: false };
  }
}

/**
 * Save settings from native app.
 */
async function handleSaveSettings(message: {
  appSettings?: unknown;
  providerSettings?: unknown;
}): Promise<{ success: boolean }> {
  try {
    const updates: Record<string, unknown> = {};

    if (message.appSettings) {
      updates.lex_settings = message.appSettings;
    }
    if (message.providerSettings) {
      updates.lex_provider_settings = message.providerSettings;
    }

    await safariRuntime.storage.local.set(updates);
    return { success: true };
  } catch (error) {
    console.error('[Lex Safari Background] Failed to save settings:', error);
    return { success: false };
  }
}

/**
 * Handle toolbar button (action) click.
 * Gets selected text and triggers lookup in content script.
 */
safariRuntime.action.onClicked.addListener(async (tab) => {
  console.log('[Lex Safari Background] Toolbar button clicked');

  if (!tab?.id) {
    console.error('[Lex Safari Background] No active tab');
    return;
  }

  try {
    // Get selected text from content script
    const response = await safariRuntime.tabs.sendMessage(tab.id, {
      type: 'GET_SELECTED_TEXT',
    }) as { selectedText?: string; context?: string };

    console.log('[Lex Safari Background] Selected text:', response);

    // Send lookup request to content script (even with empty text to show settings)
    await safariRuntime.tabs.sendMessage(tab.id, {
      type: 'LOOKUP_WORD',
      word: response?.selectedText || '',
      context: response?.context,
    });
  } catch (error) {
    console.error('[Lex Safari Background] Failed to handle toolbar click:', error);
  }
});

/**
 * Handle extension installation/update.
 */
safariRuntime.runtime.onInstalled.addListener((details) => {
  console.log('[Lex Safari Background] Extension installed/updated:', details.reason);

  if (details.reason === 'install') {
    // First install - could show onboarding or set defaults
    console.log('[Lex Safari] First install detected');
  }
});

/**
 * Fetch settings from native iOS app and store in safariRuntime.storage.
 * This makes settings available to content scripts.
 */
async function syncNativeSettings(): Promise<void> {
  try {
    console.log('[Lex Safari Background] Syncing native settings...');

    // Safari's sendNativeMessage - use app bundle ID
    const response = await safariRuntime.runtime.sendNativeMessage(
      'net.sirius-lab.lex-dict',
      { type: 'GET_API_KEYS' }
    ) as {
      status?: string;
      merriamWebsterKey?: string;
      openAIKey?: string;
      providerSettings?: Record<string, boolean>;
    };

    console.log('[Lex Safari Background] Native response:', JSON.stringify(response));

    if (response?.status === 'ok') {
      // Store in safariRuntime.storage for content scripts to read
      await safariRuntime.storage.local.set({
        'lex_native_settings': {
          merriamWebsterKey: response.merriamWebsterKey || '',
          openAIKey: response.openAIKey || '',
          providerSettings: response.providerSettings || {}
        }
      });
      console.log('[Lex Safari Background] Settings synced to safariRuntime.storage');
    }
  } catch (error) {
    console.error('[Lex Safari Background] Failed to sync native settings:', error);
  }
}

// Sync settings on startup
syncNativeSettings();

// Re-sync when extension button is clicked (before lookup)
safariRuntime.runtime.onMessage.addListener((message) => {
  if (message.type === 'SYNC_SETTINGS') {
    syncNativeSettings();
  }
});

console.log('[Lex Safari Background] Background script loaded');
