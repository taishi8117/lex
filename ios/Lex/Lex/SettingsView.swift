import SwiftUI

struct SettingsView: View {
    var body: some View {
        NavigationView {
            List {
                // Safari Extension Section
                Section(header: Text("Safari Extension")) {
                    Button(action: openSafariExtensionPreferences) {
                        HStack {
                            Image(systemName: "safari")
                                .foregroundColor(.blue)
                            Text("Open Safari Extension Settings")
                        }
                    }

                    Text("Enable the Lex extension in Safari Settings → Extensions")
                        .font(.caption)
                        .foregroundColor(.secondary)
                }

                // How to Use Section
                Section(header: Text("How to Use")) {
                    HStack(alignment: .top, spacing: 12) {
                        Text("1.")
                            .font(.headline)
                            .foregroundColor(.blue)
                        VStack(alignment: .leading, spacing: 4) {
                            Text("Select text on any webpage")
                                .font(.body)
                            Text("Long-press or double-tap to select a word")
                                .font(.caption)
                                .foregroundColor(.secondary)
                        }
                    }
                    .padding(.vertical, 4)

                    HStack(alignment: .top, spacing: 12) {
                        Text("2.")
                            .font(.headline)
                            .foregroundColor(.blue)
                        VStack(alignment: .leading, spacing: 4) {
                            Text("Tap the Lex extension button")
                                .font(.body)
                            Text("In the Safari toolbar")
                                .font(.caption)
                                .foregroundColor(.secondary)
                        }
                    }
                    .padding(.vertical, 4)

                    HStack(alignment: .top, spacing: 12) {
                        Text("3.")
                            .font(.headline)
                            .foregroundColor(.blue)
                        VStack(alignment: .leading, spacing: 4) {
                            Text("View definitions")
                                .font(.body)
                            Text("Tap the gear icon to configure sources")
                                .font(.caption)
                                .foregroundColor(.secondary)
                        }
                    }
                    .padding(.vertical, 4)
                }

                // Settings Note
                Section(footer: Text("All settings including dictionary sources and API keys are configured within the extension. Tap the gear icon in the extension popup to access settings.")) {
                    HStack {
                        Image(systemName: "gearshape")
                            .foregroundColor(.blue)
                            .frame(width: 24)
                        Text("Settings are in the extension")
                            .foregroundColor(.secondary)
                    }
                }

                // About Section
                Section(header: Text("About")) {
                    HStack {
                        Text("Version")
                        Spacer()
                        Text(Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "1.0")
                            .foregroundColor(.secondary)
                    }

                    Link(destination: URL(string: "https://github.com/anthropics/claude-code/issues")!) {
                        HStack {
                            Text("Report an Issue")
                            Spacer()
                            Image(systemName: "arrow.up.right.square")
                                .foregroundColor(.secondary)
                        }
                    }
                }
            }
            .navigationTitle("Lex Dictionary")
        }
    }

    private func openSafariExtensionPreferences() {
        if let url = URL(string: "App-Prefs:SAFARI&path=WEB_EXTENSIONS") {
            UIApplication.shared.open(url)
        } else if let url = URL(string: UIApplication.openSettingsURLString) {
            UIApplication.shared.open(url)
        }
    }
}

#Preview {
    SettingsView()
}
