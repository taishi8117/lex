# iOS Safari Extension Development Guide

This guide covers how to continue development on macOS after the initial implementation on Linux.

## Prerequisites

- macOS 13+ (Ventura or later recommended)
- Xcode 14+ (download from App Store)
- Node.js 18+ and npm
- Apple ID (free) or Apple Developer account ($99/year for TestFlight)

## Initial Setup on Mac

### 1. Clone and Install Dependencies

```bash
git clone <your-repo-url>
cd lex
npm install
```

### 2. Verify Builds Work

```bash
# Test Chrome extension build
npm run build

# Test Safari web extension build
npm run build:safari
```

Both should complete without errors.

## Creating the Xcode Project

The web extension code is ready, but you need to create the Xcode project to package it as an iOS app.

### 1. Create New Xcode Project

1. Open Xcode
2. **File → New → Project**
3. Select **iOS → App**
4. Configure:
   - Product Name: `Lex`
   - Team: Your Apple ID
   - Organization Identifier: `com.yourname` (or your domain)
   - Interface: **SwiftUI**
   - Language: **Swift**
5. Save to `ios/Lex/` (replace the placeholder directory)

### 2. Add Safari Web Extension Target

1. **File → New → Target**
2. Select **Safari Extension** (under iOS)
3. Configure:
   - Product Name: `Lex Extension`
   - Language: Swift
   - Type: **Safari Web Extension**
4. When prompted "Activate scheme?", click **Activate**

### 3. Add Action Extension Target (Share Sheet)

1. **File → New → Target**
2. Select **Action Extension** (under iOS)
3. Configure:
   - Product Name: `Lex Action Extension`
   - Action Type: **Presents User Interface**

### 4. Configure App Groups

This allows the main app and extensions to share data.

1. Select the **Lex** project in the navigator
2. Select **Lex** target → **Signing & Capabilities**
3. Click **+ Capability** → **App Groups**
4. Add: `group.com.yourname.lex` (use your org identifier)
5. Repeat for **Lex Extension** and **Lex Action Extension** targets

### 5. Copy Swift Source Files

Copy the prepared Swift files into the Xcode project:

```bash
# From the project root
cp ios/Lex/Lex/SettingsView.swift <Xcode-Lex-folder>/
cp ios/Lex/Lex\ Extension/SafariWebExtensionHandler.swift <Xcode-Extension-folder>/
```

Then in Xcode, right-click each target folder and **Add Files to "Lex"** to include them.

### 6. Update Main App Entry Point

Replace the default `ContentView.swift` or `LexApp.swift` to use `SettingsView`:

```swift
// LexApp.swift
import SwiftUI

@main
struct LexApp: App {
    var body: some Scene {
        WindowGroup {
            SettingsView()
        }
    }
}
```

### 7. Configure Web Extension Resources

1. In Xcode, select the **Lex Extension** target
2. Go to **Build Phases → Copy Bundle Resources**
3. Remove any default placeholder files
4. Add the built web extension files from `ios/Lex/Lex Extension/Resources/`:
   - `manifest.json`
   - `content.js`
   - `background.js`
   - `assets/` folder
   - `icons/` folder (or copy from `public/icons/`)

### 8. Update App Group Identifier

Edit `SettingsView.swift` and `SafariWebExtensionHandler.swift` to use your App Group:

```swift
// Change this line in both files:
let userDefaults = UserDefaults(suiteName: "group.com.yourname.lex")
```

## Build and Run

### On Simulator

1. Select **Lex** scheme in Xcode
2. Choose an iOS Simulator (iPhone 14, etc.)
3. Click **Run** (⌘R)
4. The app will install on the simulator

### Enable the Extension

1. On the simulator, open **Settings**
2. Go to **Safari → Extensions**
3. Enable **Lex**
4. Set permission to **All Websites**

### Test the Extension

1. Open Safari on the simulator
2. Navigate to any webpage with text (e.g., wikipedia.org)
3. **Long-press** on a word
4. The bottom sheet should appear with definitions

## Development Workflow

### Making Changes to Web Code

1. Edit files in `src/` or `src-safari/`
2. Run `npm run build:safari`
3. In Xcode, the Resources folder should auto-update
4. Rebuild and run in Xcode (⌘R)

### Watch Mode (Optional)

For faster iteration:

```bash
# Terminal 1: Watch for changes
npm run watch:safari

# Then rebuild in Xcode when ready to test
```

### Debugging

**JavaScript Console:**
1. In Safari on Mac, enable **Develop** menu (Preferences → Advanced)
2. Connect simulator or device
3. **Develop → [Device] → [Page]** to open Web Inspector

**Swift Debugging:**
- Use Xcode's debugger as normal
- Add breakpoints in Swift files

## Testing on Physical Device

### With Free Apple ID

1. Connect iPhone via USB
2. Select your device in Xcode
3. **Run** (⌘R)
4. On first run, trust the developer certificate on device:
   - Settings → General → VPN & Device Management → Trust

**Limitations:**
- App expires after 7 days (rebuild to refresh)
- Maximum 3 devices per Apple ID

### With Apple Developer Account ($99/year)

1. Enroll at developer.apple.com
2. In Xcode, sign in with your Developer account
3. Build and run normally
4. Apps last 1 year before expiring

## TestFlight Distribution

Requires Apple Developer account.

1. In Xcode: **Product → Archive**
2. In Organizer: **Distribute App → App Store Connect**
3. Upload to App Store Connect
4. In App Store Connect web portal:
   - Add testers
   - Submit for TestFlight review (usually <24 hours)

## Troubleshooting

### Extension Not Appearing in Safari Settings

- Ensure the extension target is properly signed
- Check that App Groups are configured on all targets
- Try deleting the app and reinstalling

### Web Extension Not Loading

- Verify manifest.json is in Copy Bundle Resources
- Check Safari Web Inspector console for errors
- Ensure host_permissions include the test site

### Build Errors

```bash
# Clean build folder
rm -rf ios/Lex/Lex\ Extension/Resources/*.js
rm -rf ios/Lex/Lex\ Extension/Resources/*.map
npm run build:safari
```

### "App Group Not Found" Errors

- Verify the App Group identifier matches exactly in:
  - Xcode capabilities (all targets)
  - Swift code (UserDefaults suiteName)

## Project Structure After Setup

```
ios/Lex/
├── Lex.xcodeproj/
├── Lex/
│   ├── LexApp.swift           # App entry point
│   ├── SettingsView.swift     # Main settings UI
│   └── Assets.xcassets/       # App icons
├── Lex Extension/
│   ├── SafariWebExtensionHandler.swift
│   ├── Resources/             # Built web extension (from npm run build:safari)
│   │   ├── manifest.json
│   │   ├── content.js
│   │   ├── background.js
│   │   └── assets/
│   └── Info.plist
└── Lex Action Extension/      # Share Sheet
    ├── ActionViewController.swift
    └── Info.plist
```

## Next Steps

1. [ ] Create Xcode project following steps above
2. [ ] Test long-press functionality on simulator
3. [ ] Test on physical device
4. [ ] Add app icons (1024x1024 for App Store)
5. [ ] Implement Action Extension for Share Sheet (optional)
6. [ ] Submit to TestFlight for beta testing
7. [ ] Submit to App Store
