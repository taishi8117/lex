export interface SelectionResult {
  text: string;
  position: { x: number; y: number };
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

    let selectedText = selection.toString().trim();
    if (!selectedText || selectedText.length > 100) return;

    // Try to expand selection to detect idioms/phrases
    selectedText = this.tryExpandToIdiom(selection, selectedText);

    // Calculate popup position
    const position = this.calculatePosition(event, selection);

    this.callback({ text: selectedText, position });
  };

  /**
   * Attempt to expand selection to capture multi-word idioms.
   */
  private tryExpandToIdiom(selection: Selection, word: string): string {
    try {
      const range = selection.getRangeAt(0);
      const container = range.commonAncestorContainer;

      if (container.nodeType !== Node.TEXT_NODE) return word;

      const text = container.textContent || '';
      const wordStart = range.startOffset;
      const wordEnd = range.endOffset;

      // Get surrounding context (up to 30 chars each side)
      const contextStart = Math.max(0, wordStart - 30);
      const contextEnd = Math.min(text.length, wordEnd + 30);
      const context = text.substring(contextStart, contextEnd);

      // Look for common idiom patterns
      const idiomPatterns = [
        // Phrasal verbs: "give up", "look after"
        /\b(\w+)\s+(up|down|out|in|off|on|over|away|back|through)\b/gi,
        // Common phrases with articles
        /\b(a|the|an)\s+\w+\s+(of|in|on|at)\s+\w+/gi,
        // "X and Y" patterns
        /\b\w+\s+and\s+\w+\b/gi,
      ];

      // Check if selected word is part of a common pattern
      for (const pattern of idiomPatterns) {
        const matches = context.matchAll(pattern);
        for (const match of matches) {
          if (match[0].toLowerCase().includes(word.toLowerCase())) {
            // Return the matched phrase if it's reasonable length
            if (match[0].split(/\s+/).length <= 5) {
              return match[0].trim();
            }
          }
        }
      }

      return word;
    } catch {
      return word;
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
