# Lex Dictionary

A Chrome extension for multi-source dictionary lookups. Double-click any word to see definitions from multiple sources simultaneously.

## Features

- **Multi-source lookups**: Query multiple dictionaries in parallel
- **Configurable sources**: Enable/disable and reorder sources
- **Context-aware AI**: Optional OpenAI-powered analysis with surrounding context
- **Keyboard shortcut**: Click extension icon with text selected
- **Context menu**: Right-click selected text to look up

## Dictionary Sources

| Source | Description | API Key |
|--------|-------------|---------|
| Free Dictionary | Open-source dictionary with pronunciations | No |
| Merriam-Webster Collegiate | Comprehensive dictionary for advanced users | Yes |
| Merriam-Webster Learner's | Simplified definitions for learners | Yes |
| Wikipedia | Encyclopedia summaries for concepts and proper nouns | No |
| Urban Dictionary | Slang and informal definitions | No |
| Jisho | Japanese-English dictionary | No |
| OpenAI | AI-powered contextual analysis | Yes |

## Installation

### From source

```bash
# Clone and install
git clone <repo-url>
cd lex
npm install

# Build
npm run build

# Load in Chrome
# 1. Go to chrome://extensions
# 2. Enable "Developer mode"
# 3. Click "Load unpacked"
# 4. Select the `dist` folder
```

### Development

```bash
# Watch mode (rebuilds on changes)
npm run watch
```

## Usage

1. **Double-click** any word on a webpage to see definitions
2. **Select text + click extension icon** to look up phrases
3. **Right-click selected text** and choose "Look up" (when available)
4. **Drag** the popup header to reposition
5. **Press Escape** or click outside to close

## Configuration

Click the extension icon with no text selected, or right-click the extension icon and select "Options" to:

- Enable/disable dictionary sources
- Reorder sources (drag to reorder)
- Configure API keys for Merriam-Webster and OpenAI
- Adjust source-specific settings

## API Keys

Some sources require API keys:

- **Merriam-Webster**: Free key from [dictionaryapi.com](https://dictionaryapi.com/)
- **OpenAI**: From [platform.openai.com](https://platform.openai.com/)

## Tech Stack

- TypeScript
- React 18
- Vite + CRXJS
- Chrome Extension Manifest V3
