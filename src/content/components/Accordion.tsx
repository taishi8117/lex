import React, { useState, useRef } from 'react';

interface AccordionSectionProps {
  id: string;
  title: string;
  loading?: boolean;
  error?: boolean;
  defaultExpanded?: boolean;
  children: React.ReactNode;
}

export function AccordionSection({
  id,
  title,
  loading = false,
  error = false,
  defaultExpanded = false,
  children,
}: AccordionSectionProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const contentRef = useRef<HTMLDivElement>(null);
  const headerId = `lex-header-${id}`;
  const panelId = `lex-panel-${id}`;

  const toggle = () => {
    if (!loading) {
      setExpanded(!expanded);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      toggle();
    }
  };

  return (
    <div className={`lex-accordion-section ${error ? 'lex-accordion-section--error' : ''}`}>
      <button
        id={headerId}
        className="lex-accordion-header"
        onClick={toggle}
        onKeyDown={handleKeyDown}
        aria-expanded={expanded}
        aria-controls={panelId}
        disabled={loading}
      >
        <span className={`lex-accordion-icon ${expanded ? 'lex-accordion-icon--expanded' : ''}`}>
          <ChevronIcon />
        </span>
        <span className="lex-accordion-title">{title}</span>
        {loading && <span className="lex-spinner" aria-label="Loading" />}
        {error && <span className="lex-error-icon" aria-label="Error">!</span>}
      </button>

      <div
        id={panelId}
        role="region"
        aria-labelledby={headerId}
        className={`lex-accordion-content ${expanded ? 'lex-accordion-content--expanded' : ''}`}
        hidden={!expanded}
      >
        <div ref={contentRef} className="lex-accordion-content-inner">
          {children}
        </div>
      </div>
    </div>
  );
}

function ChevronIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 12 12"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        d="M4.5 2.5L8 6L4.5 9.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

interface AccordionProps {
  children: React.ReactNode;
}

export function Accordion({ children }: AccordionProps) {
  return (
    <div className="lex-accordion" role="tablist">
      {children}
    </div>
  );
}
