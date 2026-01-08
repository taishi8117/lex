/**
 * Options page script for Safari extension.
 * Allows users to configure providers and API keys.
 */

console.log('[Lex Options] Script loading...');

// Browser API (provided by Safari)
const safariAPI = (globalThis as typeof globalThis & { browser?: typeof chrome }).browser;

console.log('[Lex Options] Browser API available:', !!safariAPI);

interface LexSettings {
  providers: {
    'free-dictionary': boolean;
    'wikipedia': boolean;
    'urban-dictionary': boolean;
    'jisho': boolean;
    'openai': boolean;
    'mw-collegiate': boolean;
    'mw-learners': boolean;
  };
  apiKeys: {
    openai: string;
    merriamWebster: string;
  };
}

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
  apiKeys: {
    openai: '',
    merriamWebster: '',
  },
};

// Initialize when page loads
document.addEventListener('DOMContentLoaded', async () => {
  console.log('[Lex Options] DOMContentLoaded fired');

  try {
    const settings = await loadSettings();
    console.log('[Lex Options] Settings loaded:', settings);
    applySettingsToUI(settings);
    setupEventListeners();
    console.log('[Lex Options] Initialization complete');
  } catch (error) {
    console.error('[Lex Options] Initialization error:', error);
  }
});

async function loadSettings(): Promise<LexSettings> {
  try {
    if (!safariAPI?.storage?.local) {
      console.log('[Lex Options] Storage API not available, using defaults');
      return DEFAULT_SETTINGS;
    }
    const result = await safariAPI.storage.local.get('lex_extension_settings');
    return result.lex_extension_settings || DEFAULT_SETTINGS;
  } catch (error) {
    console.error('[Lex Options] Failed to load settings:', error);
    return DEFAULT_SETTINGS;
  }
}

async function saveSettings(settings: LexSettings): Promise<void> {
  try {
    if (!safariAPI?.storage?.local) {
      console.log('[Lex Options] Storage API not available, cannot save');
      return;
    }
    await safariAPI.storage.local.set({ lex_extension_settings: settings });
    console.log('[Lex Options] Settings saved:', settings);
    showStatus();
  } catch (error) {
    console.error('[Lex Options] Failed to save settings:', error);
  }
}

function applySettingsToUI(settings: LexSettings): void {
  // Provider checkboxes
  for (const [id, enabled] of Object.entries(settings.providers)) {
    const checkbox = document.getElementById(id) as HTMLInputElement;
    if (checkbox) {
      checkbox.checked = enabled;
    }
  }

  // API keys
  const openaiKeyInput = document.getElementById('openai-key') as HTMLInputElement;
  const mwKeyInput = document.getElementById('mw-key') as HTMLInputElement;

  if (openaiKeyInput) {
    openaiKeyInput.value = settings.apiKeys.openai;
  }
  if (mwKeyInput) {
    mwKeyInput.value = settings.apiKeys.merriamWebster;
  }
}

function getSettingsFromUI(): LexSettings {
  const providers = {
    'free-dictionary': (document.getElementById('free-dictionary') as HTMLInputElement)?.checked ?? true,
    'wikipedia': (document.getElementById('wikipedia') as HTMLInputElement)?.checked ?? true,
    'urban-dictionary': (document.getElementById('urban-dictionary') as HTMLInputElement)?.checked ?? true,
    'jisho': (document.getElementById('jisho') as HTMLInputElement)?.checked ?? false,
    'openai': (document.getElementById('openai') as HTMLInputElement)?.checked ?? false,
    'mw-collegiate': (document.getElementById('mw-collegiate') as HTMLInputElement)?.checked ?? false,
    'mw-learners': (document.getElementById('mw-learners') as HTMLInputElement)?.checked ?? false,
  };

  const apiKeys = {
    openai: (document.getElementById('openai-key') as HTMLInputElement)?.value ?? '',
    merriamWebster: (document.getElementById('mw-key') as HTMLInputElement)?.value ?? '',
  };

  return { providers, apiKeys };
}

function setupEventListeners(): void {
  const inputs = document.querySelectorAll('input');
  inputs.forEach((input) => {
    input.addEventListener('change', () => {
      const settings = getSettingsFromUI();
      saveSettings(settings);
    });

    // Also save on input for text fields (debounced)
    if (input.type === 'password' || input.type === 'text') {
      let timeout: number;
      input.addEventListener('input', () => {
        clearTimeout(timeout);
        timeout = window.setTimeout(() => {
          const settings = getSettingsFromUI();
          saveSettings(settings);
        }, 500);
      });
    }
  });
}

function showStatus(): void {
  const status = document.getElementById('status');
  if (status) {
    status.classList.add('show');
    setTimeout(() => {
      status.classList.remove('show');
    }, 2000);
  }
}
