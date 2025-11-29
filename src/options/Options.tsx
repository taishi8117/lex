import { useState, useEffect, useCallback } from 'react';
import { providerRegistry } from '@/providers/registry';
import type { ProviderRegistration } from '@/providers/types';
import { SourceConfig } from './SourceConfig';

export function Options() {
  const [registrations, setRegistrations] = useState<ProviderRegistration[]>([]);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Load registrations on mount
  useEffect(() => {
    const loadSettings = async () => {
      await providerRegistry.loadFromStorage();
      setRegistrations(providerRegistry.getAllRegistrations());
    };
    loadSettings();
  }, []);

  const handleToggle = useCallback((providerId: string, enabled: boolean) => {
    providerRegistry.updateConfig(providerId, { enabled });
    setRegistrations(providerRegistry.getAllRegistrations());
  }, []);

  const handleConfigChange = useCallback(
    (providerId: string, key: string, value: unknown) => {
      const registration = providerRegistry.getRegistration(providerId);
      if (registration) {
        providerRegistry.updateConfig(providerId, {
          config: { ...registration.config, [key]: value },
        });
        setRegistrations(providerRegistry.getAllRegistrations());
      }
    },
    []
  );

  const handleReorder = useCallback((fromIndex: number, toIndex: number) => {
    const regs = [...providerRegistry.getAllRegistrations()];
    const [moved] = regs.splice(fromIndex, 1);
    regs.splice(toIndex, 0, moved);

    // Update order values
    regs.forEach((reg, index) => {
      providerRegistry.updateConfig(reg.provider.metadata.id, { order: index * 10 });
    });

    setRegistrations(providerRegistry.getAllRegistrations());
  }, []);

  const handleSave = useCallback(async () => {
    setSaving(true);
    setMessage(null);

    try {
      await providerRegistry.saveToStorage();
      setMessage({ type: 'success', text: 'Settings saved successfully!' });
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to save settings' });
    } finally {
      setSaving(false);
    }
  }, []);

  const handleValidate = useCallback(async (providerId: string) => {
    const provider = providerRegistry.getProvider(providerId);
    if (!provider) return;

    const result = await provider.validateConfig();
    setMessage({
      type: result.valid ? 'success' : 'error',
      text: result.message || (result.valid ? 'Configuration valid' : 'Configuration invalid'),
    });
  }, []);

  return (
    <div className="options-container">
      <header className="options-header">
        <h1>Lex Dictionary Settings</h1>
        <p>Configure dictionary sources and their settings</p>
      </header>

      {message && (
        <div className={`message message--${message.type}`}>
          {message.text}
          <button onClick={() => setMessage(null)} className="message-close">
            ×
          </button>
        </div>
      )}

      <section className="options-section">
        <h2>Dictionary Sources</h2>
        <p className="section-description">
          Enable, disable, and configure your dictionary sources. Drag to reorder.
        </p>

        <div className="source-list">
          {registrations.map((reg, index) => (
            <SourceConfig
              key={reg.provider.metadata.id}
              registration={reg}
              index={index}
              onToggle={handleToggle}
              onConfigChange={handleConfigChange}
              onReorder={handleReorder}
              onValidate={handleValidate}
            />
          ))}
        </div>
      </section>

      <footer className="options-footer">
        <button onClick={handleSave} disabled={saving} className="save-button">
          {saving ? 'Saving...' : 'Save Settings'}
        </button>
      </footer>
    </div>
  );
}
