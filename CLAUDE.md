# Lex - Claude Code Context

## Project Overview

Lex is a browser extension for multi-source dictionary lookups. Double-click any word to see definitions from multiple sources simultaneously.

## Tech Stack

- TypeScript, React 18, Vite + CRXJS
- Chrome Extension Manifest V3
- 7 dictionary providers (Free Dictionary, Merriam-Webster x2, Wikipedia, Urban Dictionary, Jisho, OpenAI)

## Architecture

- `src/providers/` - Dictionary provider plugins (DictionaryProvider interface)
- `src/services/` - Core services (lookup, cache, settings)
- `src/content/` - Content script (popup UI, selection handler)
- `src/background/` - Service worker (context menu, messaging)
- `src/options/` - Options page (settings UI)

## Build Commands

- `npm run build` - Build Chrome extension to `dist/`
- `npm run watch` - Watch mode for development
- `npm run build:safari` - Build Safari extension (after iOS support added)

## iOS Safari Extension (Implemented)

Target: iOS Safari with long-press trigger, Share Sheet, and bottom sheet UI.

### iOS-Specific Files

- `src-safari/` - Safari-specific web code
  - `content/long-press-handler.ts` - Touch-based word detection
  - `content/bottom-sheet.tsx` - Mobile-friendly slide-up UI
  - `content/index.tsx` - Safari content script entry
  - `background/safari-background.ts` - Safari background script
  - `styles/bottom-sheet.css` - Bottom sheet styling
- `ios/Lex/` - Xcode project structure (requires macOS to complete)
- `vite.config.safari.ts` - Safari build config

### Key Differences from Chrome

| Feature | Chrome | iOS Safari |
|---------|--------|------------|
| Trigger | Double-click, context menu | Long-press, Share Sheet |
| UI | Draggable popup | Bottom sheet |
| Storage | chrome.storage (10MB) | browser.storage (50KB) |
| Background | Service Worker | Background page |

### iOS Build Requirements

- macOS with Xcode 14+ for final builds
- Free Apple ID for personal device testing
- Apple Developer ($99/yr) for TestFlight/App Store
