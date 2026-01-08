/**
 * Long-press handler for iOS Safari.
 * Detects long-press gestures on words and triggers lookup.
 */

export interface LongPressResult {
  word: string;
  rect: DOMRect;
  context?: string;
}

export type LongPressCallback = (result: LongPressResult) => void;

export class LongPressHandler {
  private callback: LongPressCallback;
  private longPressTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly LONG_PRESS_DURATION = 500; // ms
  private touchStartPos: { x: number; y: number } | null = null;
  private readonly MOVE_THRESHOLD = 10; // pixels - cancel if finger moves more than this

  constructor(callback: LongPressCallback) {
    this.callback = callback;
  }

  /**
   * Attach event listeners to the document.
   */
  attach(): void {
    document.addEventListener('touchstart', this.handleTouchStart, { passive: true });
    document.addEventListener('touchmove', this.handleTouchMove, { passive: true });
    document.addEventListener('touchend', this.handleTouchEnd);
    document.addEventListener('touchcancel', this.handleTouchCancel);
  }

  /**
   * Remove event listeners from the document.
   */
  detach(): void {
    this.clearTimer();
    document.removeEventListener('touchstart', this.handleTouchStart);
    document.removeEventListener('touchmove', this.handleTouchMove);
    document.removeEventListener('touchend', this.handleTouchEnd);
    document.removeEventListener('touchcancel', this.handleTouchCancel);
  }

  private handleTouchStart = (e: TouchEvent): void => {
    // Only handle single-finger touches
    if (e.touches.length !== 1) return;

    const touch = e.touches[0];
    const target = document.elementFromPoint(touch.clientX, touch.clientY);

    // Don't trigger on editable elements
    if (!target || this.isEditableElement(target as HTMLElement)) return;

    this.touchStartPos = { x: touch.clientX, y: touch.clientY };

    // Start the long-press timer
    this.longPressTimer = setTimeout(() => {
      this.triggerLongPress(touch.clientX, touch.clientY);
    }, this.LONG_PRESS_DURATION);
  };

  private handleTouchMove = (e: TouchEvent): void => {
    if (!this.touchStartPos || e.touches.length !== 1) return;

    const touch = e.touches[0];
    const dx = Math.abs(touch.clientX - this.touchStartPos.x);
    const dy = Math.abs(touch.clientY - this.touchStartPos.y);

    // Cancel if finger moved too much
    if (dx > this.MOVE_THRESHOLD || dy > this.MOVE_THRESHOLD) {
      this.clearTimer();
    }
  };

  private handleTouchEnd = (): void => {
    this.clearTimer();
  };

  private handleTouchCancel = (): void => {
    this.clearTimer();
  };

  private clearTimer(): void {
    if (this.longPressTimer) {
      clearTimeout(this.longPressTimer);
      this.longPressTimer = null;
    }
    this.touchStartPos = null;
  }

  private triggerLongPress(x: number, y: number): void {
    // Get the word at the touch point
    const result = this.getWordAtPoint(x, y);
    if (!result) return;

    // Provide haptic feedback if available
    if ('vibrate' in navigator) {
      navigator.vibrate(10);
    }

    this.callback(result);
    this.clearTimer();
  }

  /**
   * Get the word at the specified point using caretRangeFromPoint.
   */
  private getWordAtPoint(x: number, y: number): LongPressResult | null {
    // Use caretRangeFromPoint (WebKit) to get the text position
    let range: Range | null = null;

    if (document.caretRangeFromPoint) {
      range = document.caretRangeFromPoint(x, y);
    } else if ((document as unknown as { caretPositionFromPoint: (x: number, y: number) => { offsetNode: Node; offset: number } | null }).caretPositionFromPoint) {
      const pos = (document as unknown as { caretPositionFromPoint: (x: number, y: number) => { offsetNode: Node; offset: number } | null }).caretPositionFromPoint(x, y);
      if (pos) {
        range = document.createRange();
        range.setStart(pos.offsetNode, pos.offset);
        range.setEnd(pos.offsetNode, pos.offset);
      }
    }

    if (!range || range.startContainer.nodeType !== Node.TEXT_NODE) {
      return null;
    }

    // Expand range to word boundaries
    const textNode = range.startContainer as Text;
    const text = textNode.textContent || '';
    const offset = range.startOffset;

    // Find word boundaries using regex
    const wordRegex = /[\w'-]+/g;
    let match: RegExpExecArray | null;

    while ((match = wordRegex.exec(text)) !== null) {
      const start = match.index;
      const end = start + match[0].length;

      if (offset >= start && offset <= end) {
        // Found the word containing the touch point
        const wordRange = document.createRange();
        wordRange.setStart(textNode, start);
        wordRange.setEnd(textNode, end);

        const rect = wordRange.getBoundingClientRect();
        const word = match[0];

        // Validate word length
        if (word.length < 2 || word.length > 50) return null;

        // Skip words that are all numbers
        if (/^\d+$/.test(word)) return null;

        // Get surrounding context for AI providers
        const context = this.getSurroundingContext(textNode, start, end);

        return { word, rect, context };
      }
    }

    return null;
  }

  /**
   * Extract surrounding sentence context for AI providers.
   */
  private getSurroundingContext(
    textNode: Text,
    wordStart: number,
    wordEnd: number
  ): string | undefined {
    const fullText = textNode.textContent || '';

    // Find sentence boundaries
    const beforeText = fullText.substring(0, wordStart);
    const afterText = fullText.substring(wordEnd);

    // Find the start of the sentence
    const sentenceStart = Math.max(
      beforeText.lastIndexOf('. ') + 2,
      beforeText.lastIndexOf('! ') + 2,
      beforeText.lastIndexOf('? ') + 2,
      beforeText.lastIndexOf('\n') + 1,
      0
    );

    // Find the end of the sentence
    const sentenceEndMatch = afterText.match(/[.!?]\s/);
    const sentenceEnd = sentenceEndMatch
      ? wordEnd + sentenceEndMatch.index! + 1
      : Math.min(wordEnd + 200, fullText.length);

    const context = fullText.substring(sentenceStart, sentenceEnd).trim();

    // Only return context if it's meaningful (more than just the word)
    return context.length > 20 ? context : undefined;
  }

  /**
   * Check if an element is editable (input, textarea, contenteditable).
   */
  private isEditableElement(element: HTMLElement): boolean {
    const tagName = element.tagName.toLowerCase();
    if (tagName === 'input' || tagName === 'textarea') return true;
    if (element.isContentEditable) return true;
    if (element.closest('[contenteditable="true"]')) return true;
    return false;
  }
}
