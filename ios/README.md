# iOS Safari Extension Setup

This directory contains the iOS app and Safari extension for Lex Dictionary.

## Prerequisites

- macOS with Xcode 14+
- Apple Developer account (free for personal testing, $99/year for TestFlight/App Store)
- iOS 15.4+ device or simulator

## Setup Instructions

### 1. Create Xcode Project

Open Xcode and create a new project:

1. **File → New → Project**
2. Select **iOS → App**
3. Configure:
   - Product Name: `Lex`
   - Team: Your Apple ID or Developer account
   - Organization Identifier: `com.yourname` (or your domain)
   - Interface: SwiftUI
   - Language: Swift
4. Save to `ios/Lex/`

### 2. Add Safari Web Extension Target

1. **File → New → Target**
2. Select **Safari Extension**
3. Configure:
   - Product Name: `Lex Extension`
   - Type: Safari Web Extension
   - Language: Swift
4. When prompted, activate the new scheme

### 3. Add Action Extension Target (Share Sheet)

1. **File → New → Target**
2. Select **Action Extension**
3. Configure:
   - Product Name: `Lex Action Extension`
   - Action Type: Presents User Interface
   - Language: Swift

### 4. Configure App Groups

1. Select the **Lex** project in navigator
2. Select the **Lex** target → Signing & Capabilities
3. Click **+ Capability** → **App Groups**
4. Add group: `group.com.lex.shared`
5. Repeat for **Lex Extension** and **Lex Action Extension** targets

### 5. Copy Source Files

Copy the Swift files from this directory into the appropriate targets:

- `Lex/SettingsView.swift` → Main app target
- `Lex Extension/SafariWebExtensionHandler.swift` → Extension target
- `Lex Extension/Resources/manifest.json` → Extension Resources

### 6. Build Web Extension

From the project root, build the Safari web extension:

```bash
npm run build:safari
```

This outputs to `ios/Lex/Lex Extension/Resources/`.

### 7. Configure Build Settings

In Xcode, for the **Lex Extension** target:

1. Build Settings → Search for "Copy Bundle Resources"
2. Ensure the following are included:
   - `Resources/manifest.json`
   - `Resources/content.js`
   - `Resources/background.js`
   - `Resources/popup/` directory

### 8. Run on Simulator or Device

1. Select the **Lex** scheme
2. Choose a simulator or connected device
3. Click **Run** (⌘R)

### 9. Enable Extension in Safari

On iOS device/simulator:

1. Open **Settings**
2. Go to **Safari → Extensions**
3. Enable **Lex**
4. Grant "All Websites" permission when prompted

## Testing

1. Open Safari on the device
2. Navigate to any webpage with text
3. **Long-press** on a word → Bottom sheet should appear with definitions
4. Or select text → Tap **Share** → Choose **Lex** (if Action Extension is configured)

## Troubleshooting

### Extension not appearing in Safari settings
- Ensure the extension is properly code-signed
- Check that App Groups are configured correctly
- Try restarting Safari or the device

### Build errors
- Run `npm run build:safari` to regenerate web extension files
- Ensure all resource files are added to the target

### API calls failing
- Check that host_permissions in manifest.json are correct
- Verify API keys are saved in the app settings

## File Structure

```
ios/
├── README.md                          # This file
└── Lex/
    ├── Lex/                           # Main app target
    │   ├── SettingsView.swift         # Settings UI
    │   ├── AppDelegate.swift          # (create via Xcode)
    │   └── Assets.xcassets/           # (create via Xcode)
    ├── Lex Extension/                 # Safari extension target
    │   ├── SafariWebExtensionHandler.swift
    │   └── Resources/                 # Web extension files (built by Vite)
    │       ├── manifest.json
    │       ├── content.js
    │       ├── background.js
    │       └── popup/
    └── Lex Action Extension/          # Share Sheet extension
        └── ActionViewController.swift # (create via Xcode)
```
