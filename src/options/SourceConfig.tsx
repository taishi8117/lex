import React, { useState } from 'react';
import type { ProviderRegistration, ProviderConfigField } from '@/providers/types';

interface SourceConfigProps {
  registration: ProviderRegistration;
  index: number;
  onToggle: (providerId: string, enabled: boolean) => void;
  onConfigChange: (providerId: string, key: string, value: unknown) => void;
  onReorder: (fromIndex: number, toIndex: number) => void;
  onValidate: (providerId: string) => void;
}

export function SourceConfig({
  registration,
  index,
  onToggle,
  onConfigChange,
  onReorder,
  onValidate,
}: SourceConfigProps) {
  const [expanded, setExpanded] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  const { provider, enabled, config } = registration;
  const { id, name, description, configFields, website, requiresApiKey } = provider.metadata;

  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData('text/plain', index.toString());
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOver(true);
  };

  const handleDragLeave = () => {
    setDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const fromIndex = parseInt(e.dataTransfer.getData('text/plain'), 10);
    if (fromIndex !== index) {
      onReorder(fromIndex, index);
    }
  };

  return (
    <div
      className={`source-card ${enabled ? 'source-card--enabled' : ''} ${dragOver ? 'source-card--drag-over' : ''}`}
      draggable
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <div className="source-header">
        <div className="source-drag-handle" title="Drag to reorder">
          <DragIcon />
        </div>

        <label className="source-toggle">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => onToggle(id, e.target.checked)}
          />
          <span className="toggle-slider" />
        </label>

        <div className="source-info">
          <h3 className="source-name">{name}</h3>
          <p className="source-description">{description}</p>
          {website && (
            <a href={website} target="_blank" rel="noopener noreferrer" className="source-link">
              Learn more →
            </a>
          )}
        </div>

        {configFields.length > 0 && (
          <button
            className="source-expand"
            onClick={() => setExpanded(!expanded)}
            aria-expanded={expanded}
            aria-label={expanded ? 'Collapse settings' : 'Expand settings'}
          >
            <ChevronIcon expanded={expanded} />
          </button>
        )}
      </div>

      {expanded && configFields.length > 0 && (
        <div className="source-config">
          {configFields.map((field) => (
            <ConfigField
              key={field.key}
              field={field}
              value={config[field.key]}
              onChange={(value) => onConfigChange(id, field.key, value)}
            />
          ))}

          {requiresApiKey && (
            <button
              className="validate-button"
              onClick={() => onValidate(id)}
            >
              Validate Configuration
            </button>
          )}
        </div>
      )}
    </div>
  );
}

interface ConfigFieldProps {
  field: ProviderConfigField;
  value: unknown;
  onChange: (value: unknown) => void;
}

function ConfigField({ field, value, onChange }: ConfigFieldProps) {
  const inputId = `field-${field.key}`;

  const renderInput = () => {
    switch (field.type) {
      case 'text':
      case 'password':
        return (
          <input
            id={inputId}
            type={field.type}
            value={(value as string) || ''}
            onChange={(e) => onChange(e.target.value)}
            placeholder={field.placeholder}
            required={field.required}
            className="config-input"
          />
        );

      case 'boolean':
        return (
          <label className="config-checkbox">
            <input
              id={inputId}
              type="checkbox"
              checked={(value as boolean) ?? field.default ?? false}
              onChange={(e) => onChange(e.target.checked)}
            />
            <span>{field.label}</span>
          </label>
        );

      case 'select':
        return (
          <select
            id={inputId}
            value={(value as string) ?? field.default ?? ''}
            onChange={(e) => onChange(e.target.value)}
            className="config-select"
          >
            {field.options?.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        );

      case 'number':
        return (
          <input
            id={inputId}
            type="number"
            value={(value as number) ?? field.default ?? ''}
            onChange={(e) => onChange(parseInt(e.target.value, 10))}
            className="config-input"
          />
        );

      default:
        return null;
    }
  };

  if (field.type === 'boolean') {
    return (
      <div className="config-field config-field--checkbox">
        {renderInput()}
        {field.description && <p className="config-description">{field.description}</p>}
      </div>
    );
  }

  return (
    <div className="config-field">
      <label htmlFor={inputId} className="config-label">
        {field.label}
        {field.required && <span className="required">*</span>}
      </label>
      {renderInput()}
      {field.description && <p className="config-description">{field.description}</p>}
    </div>
  );
}

function DragIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
      <circle cx="5" cy="3" r="1.5" />
      <circle cx="11" cy="3" r="1.5" />
      <circle cx="5" cy="8" r="1.5" />
      <circle cx="11" cy="8" r="1.5" />
      <circle cx="5" cy="13" r="1.5" />
      <circle cx="11" cy="13" r="1.5" />
    </svg>
  );
}

function ChevronIcon({ expanded }: { expanded: boolean }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      style={{ transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}
    >
      <path
        d="M4 6L8 10L12 6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
