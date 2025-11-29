export interface SelectionResult {
  text: string;
  position: { x: number; y: number };
  context?: string; // Surrounding text for AI context-awareness
}

export type SelectionCallback = (result: SelectionResult) => void;

/**
 * Handles double-click word selection and idiom detection.
 */
export class SelectionHandler {
  private callback: SelectionCallback;
  private attached = false;

  constructor(callback: SelectionCallback) {
    this.callback = callback;
  }

  attach(): void {
    if (this.attached) return;
    document.addEventListener('dblclick', this.handleDoubleClick);
    this.attached = true;
  }

  detach(): void {
    if (!this.attached) return;
    document.removeEventListener('dblclick', this.handleDoubleClick);
    this.attached = false;
  }

  private handleDoubleClick = (event: MouseEvent): void => {
    // Ignore if clicking on input elements
    const target = event.target as HTMLElement;
    if (this.isEditableElement(target)) {
      return;
    }

    const selection = window.getSelection();
    if (!selection || selection.isCollapsed) return;

    // Only use the exact selected word (no idiom expansion on double-click)
    const selectedText = selection.toString().trim();
    if (!selectedText || selectedText.length > 100) return;

    // Skip if multiple words selected (user manually selected)
    if (selectedText.includes(' ')) return;

    // Calculate popup position
    const position = this.calculatePosition(event, selection);

    // Capture surrounding context for AI providers
    const context = this.getSurroundingContext(selection);

    this.callback({ text: selectedText, position, context });
  };

  /**
   * Get surrounding text context for AI-powered lookups.
   * Captures the sentence or paragraph containing the selection.
   */
  getSurroundingContext(selection?: Selection | null): string | undefined {
    const sel = selection || window.getSelection();
    if (!sel || sel.isCollapsed) return undefined;

    try {
      const range = sel.getRangeAt(0);
      const container = range.commonAncestorContainer;

      // Get the text node or element containing the selection
      const textNode = container.nodeType === Node.TEXT_NODE
        ? container
        : range.startContainer;

      if (textNode.nodeType !== Node.TEXT_NODE) return undefined;

      const fullText = textNode.textContent || '';
      const selStart = range.startOffset;
      const selEnd = range.endOffset;

      // Find sentence boundaries (. ! ? or paragraph breaks)
      const sentenceEndPattern = /[.!?]\s+/g;

      // Find start of sentence
      let contextStart = 0;
      let match;
      sentenceEndPattern.lastIndex = 0;
      while ((match = sentenceEndPattern.exec(fullText)) !== null) {
        if (match.index + match[0].length <= selStart) {
          contextStart = match.index + match[0].length;
        } else {
          break;
        }
      }

      // Find end of sentence
      let contextEnd = fullText.length;
      sentenceEndPattern.lastIndex = selEnd;
      match = sentenceEndPattern.exec(fullText);
      if (match) {
        contextEnd = match.index + 1; // Include the punctuation
      }

      // Get the context, limiting to reasonable length
      let context = fullText.substring(contextStart, contextEnd).trim();

      // If context is too short, try to get parent element text
      if (context.length < 20 && textNode.parentElement) {
        const parentText = textNode.parentElement.textContent || '';
        if (parentText.length > context.length && parentText.length <= 500) {
          context = parentText.trim();
        }
      }

      // Limit context length
      if (context.length > 500) {
        // Try to trim to sentence boundaries near the selection
        const selectedText = sel.toString();
        const selectedIndex = context.indexOf(selectedText);
        if (selectedIndex >= 0) {
          const start = Math.max(0, selectedIndex - 200);
          const end = Math.min(context.length, selectedIndex + selectedText.length + 200);
          context = context.substring(start, end);
          if (start > 0) context = '...' + context;
          if (end < context.length) context = context + '...';
        } else {
          context = context.substring(0, 500) + '...';
        }
      }

      return context.length > 10 ? context : undefined;
    } catch {
      return undefined;
    }
  }

  private calculatePosition(event: MouseEvent, selection: Selection): { x: number; y: number } {
    try {
      const range = selection.getRangeAt(0);
      const rect = range.getBoundingClientRect();

      // Default: centered below the selection
      let x = rect.left + rect.width / 2;
      let y = rect.bottom + 10;

      // Ensure popup stays within viewport
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      const popupWidth = 380;
      const popupMaxHeight = 450;
      const margin = 10;

      // Horizontal bounds
      if (x - popupWidth / 2 < margin) {
        x = margin + popupWidth / 2;
      } else if (x + popupWidth / 2 > viewportWidth - margin) {
        x = viewportWidth - margin - popupWidth / 2;
      }

      // Vertical bounds - flip above if needed
      if (y + popupMaxHeight > viewportHeight - margin) {
        y = rect.top - popupMaxHeight - 10;
        if (y < margin) {
          y = margin;
        }
      }

      return { x, y };
    } catch {
      // Fallback to event coordinates
      return { x: event.clientX, y: event.clientY + 20 };
    }
  }

  private isEditableElement(element: HTMLElement): boolean {
    const tagName = element.tagName.toLowerCase();
    if (tagName === 'input' || tagName === 'textarea') return true;
    if (element.isContentEditable) return true;
    if (element.closest('[contenteditable="true"]')) return true;
    return false;
  }
}

/**
 * Debounce utility for cleanup callbacks.
 */
export function debounce<T extends (...args: unknown[]) => void>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: ReturnType<typeof setTimeout>;
  return (...args: Parameters<T>) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), delay);
  };
}
