/**
 * Background service worker for Lex Dictionary extension.
 * Handles context menu and messaging between content scripts.
 */

// Create context menu on installation
chrome.runtime.onInstalled.addListener((details) => {
  // Create context menu for selected text
  chrome.contextMenus.create({
    id: 'lex-lookup',
    title: 'Look up "%s"',
    contexts: ['selection'],
  });

  if (details.reason === 'install') {
    console.log('[Lex Dictionary] Extension installed');
    chrome.storage.local.set({
      lex_provider_settings: {},
    });
  } else if (details.reason === 'update') {
    console.log('[Lex Dictionary] Extension updated to version', chrome.runtime.getManifest().version);
  }
});

// Handle context menu clicks
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'lex-lookup' && info.selectionText && tab?.id) {
    // Send message to content script to show popup
    chrome.tabs.sendMessage(tab.id, {
      type: 'LOOKUP_SELECTION',
      text: info.selectionText.trim(),
    });
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

// Handle extension icon click - look up selected text
chrome.action.onClicked.addListener(async (tab) => {
  if (!tab.id) {
    chrome.runtime.openOptionsPage();
    return;
  }

  try {
    // Execute script to get selected text from the page
    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => window.getSelection()?.toString().trim() || '',
    });

    const selectedText = results?.[0]?.result;

    if (selectedText) {
      // Send message to content script to show popup
      chrome.tabs.sendMessage(tab.id, {
        type: 'LOOKUP_SELECTION',
        text: selectedText,
      });
    } else {
      // No selection - open options page
      chrome.runtime.openOptionsPage();
    }
  } catch {
    // If script injection fails (e.g., chrome:// pages), open options
    chrome.runtime.openOptionsPage();
  }
});
