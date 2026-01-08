/**
 * Safari iOS Background Script
 *
 * Handles communication between the content script and the native iOS app.
 * Note: iOS Safari doesn't support context menus, so this is simpler than Chrome.
 */

// Use WebExtensions browser API (Safari's standard)
declare const browser: typeof chrome;

/**
 * Handle messages from content scripts or native app.
 */
browser.runtime.onMessage.addListener(
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
    const tabs = await browser.tabs.query({ active: true, currentWindow: true });
    const activeTab = tabs[0];

    if (activeTab?.id) {
      // Send message to content script
      await browser.tabs.sendMessage(activeTab.id, {
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
    const result = await browser.storage.local.get([
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

    await browser.storage.local.set(updates);
    return { success: true };
  } catch (error) {
    console.error('[Lex Safari Background] Failed to save settings:', error);
    return { success: false };
  }
}

/**
 * Handle extension installation/update.
 */
browser.runtime.onInstalled.addListener((details) => {
  console.log('[Lex Safari Background] Extension installed/updated:', details.reason);

  if (details.reason === 'install') {
    // First install - could show onboarding or set defaults
    console.log('[Lex Safari] First install detected');
  }
});

console.log('[Lex Safari Background] Background script loaded');
