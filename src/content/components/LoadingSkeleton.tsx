export function LoadingSkeleton() {
  return (
    <div className="lex-skeleton-container">
      <div className="lex-skeleton lex-skeleton--title" />
      <div className="lex-skeleton lex-skeleton--line" />
      <div className="lex-skeleton lex-skeleton--line lex-skeleton--line-short" />
      <div className="lex-skeleton lex-skeleton--line" />
    </div>
  );
}

export function AccordionSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="lex-accordion-skeleton">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="lex-accordion-skeleton-item">
          <div className="lex-skeleton lex-skeleton--header" />
        </div>
      ))}
    </div>
  );
}
