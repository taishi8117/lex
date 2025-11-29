/**
 * Background service worker for Lex Dictionary extension.
 * Handles messaging between content scripts and manages extension lifecycle.
 */

// Listen for extension installation
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    console.log('[Lex Dictionary] Extension installed');
    // Set default settings
    chrome.storage.local.set({
      lex_provider_settings: {},
    });
  } else if (details.reason === 'update') {
    console.log('[Lex Dictionary] Extension updated to version', chrome.runtime.getManifest().version);
  }
});

// Handle messages from content scripts
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'GET_SETTINGS') {
    chrome.storage.local.get('lex_provider_settings').then((result) => {
      sendResponse(result.lex_provider_settings || {});
    });
    return true; // Keep channel open for async response
  }

  if (message.type === 'SAVE_SETTINGS') {
    chrome.storage.local.set({ lex_provider_settings: message.settings }).then(() => {
      sendResponse({ success: true });
    });
    return true;
  }

  return false;
});

// Handle extension icon click - open options page
chrome.action.onClicked.addListener(() => {
  chrome.runtime.openOptionsPage();
});
