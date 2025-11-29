import type { DictionaryResult, Definition, Pronunciation } from '@/providers/types';

interface DefinitionCardProps {
  result: DictionaryResult;
}

export function DefinitionCard({ result }: DefinitionCardProps) {
  return (
    <div className="lex-definition-card">
      {/* Pronunciations */}
      {result.pronunciations && result.pronunciations.length > 0 && (
        <div className="lex-pronunciations">
          {result.pronunciations.map((pron, idx) => (
            <PronunciationBadge key={idx} pronunciation={pron} />
          ))}
        </div>
      )}

      {/* Definitions grouped by part of speech */}
      <DefinitionList definitions={result.definitions} />

      {/* Etymology */}
      {result.etymology && (
        <div className="lex-etymology">
          <span className="lex-etymology-label">Origin:</span>
          <span className="lex-etymology-text">{result.etymology}</span>
        </div>
      )}

      {/* Source link */}
      {result.sourceUrl && (
        <a
          href={result.sourceUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="lex-source-link"
        >
          View full entry →
        </a>
      )}
    </div>
  );
}

function PronunciationBadge({ pronunciation }: { pronunciation: Pronunciation }) {
  const playAudio = () => {
    if (pronunciation.audioUrl) {
      const audio = new Audio(pronunciation.audioUrl);
      audio.play().catch(() => {});
    }
  };

  return (
    <span className="lex-pronunciation">
      {pronunciation.text && (
        <span className="lex-pronunciation-text">{pronunciation.text}</span>
      )}
      {pronunciation.audioUrl && (
        <button
          className="lex-pronunciation-play"
          onClick={playAudio}
          aria-label="Play pronunciation"
          title="Play pronunciation"
        >
          <SpeakerIcon />
        </button>
      )}
    </span>
  );
}

function DefinitionList({ definitions }: { definitions: Definition[] }) {
  // Group definitions by part of speech
  const grouped = definitions.reduce<Record<string, Definition[]>>((acc, def) => {
    const pos = def.partOfSpeech || 'other';
    if (!acc[pos]) acc[pos] = [];
    acc[pos].push(def);
    return acc;
  }, {});

  return (
    <div className="lex-definitions">
      {Object.entries(grouped).map(([pos, defs]) => (
        <div key={pos} className="lex-definition-group">
          <span className="lex-pos">{pos}</span>
          <ol className="lex-definition-list">
            {defs.map((def, idx) => (
              <li key={idx} className="lex-definition-item">
                <span className="lex-definition-text">{def.definition}</span>

                {def.examples && def.examples.length > 0 && (
                  <ul className="lex-examples">
                    {def.examples.map((ex, exIdx) => (
                      <li key={exIdx} className="lex-example">
                        "{ex}"
                      </li>
                    ))}
                  </ul>
                )}

                {def.synonyms && def.synonyms.length > 0 && (
                  <div className="lex-synonyms">
                    <span className="lex-label">Synonyms:</span>
                    {def.synonyms.join(', ')}
                  </div>
                )}

                {def.antonyms && def.antonyms.length > 0 && (
                  <div className="lex-antonyms">
                    <span className="lex-label">Antonyms:</span>
                    {def.antonyms.join(', ')}
                  </div>
                )}
              </li>
            ))}
          </ol>
        </div>
      ))}
    </div>
  );
}

function SpeakerIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        d="M11 5L6 9H2V15H6L11 19V5Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M15.54 8.46C16.4774 9.39764 17.0039 10.6692 17.0039 11.995C17.0039 13.3208 16.4774 14.5924 15.54 15.53"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

interface ErrorDisplayProps {
  message: string;
  retryable?: boolean;
  onRetry?: () => void;
}

export function ErrorDisplay({ message, retryable, onRetry }: ErrorDisplayProps) {
  return (
    <div className="lex-error">
      <span className="lex-error-message">{message}</span>
      {retryable && onRetry && (
        <button className="lex-error-retry" onClick={onRetry}>
          Retry
        </button>
      )}
    </div>
  );
}
