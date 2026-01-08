import SwiftUI
import SafariServices

struct SettingsView: View {
    @State private var merriamWebsterKey: String = ""
    @State private var openAIKey: String = ""
    @State private var showingSavedAlert = false

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

                // API Keys Section
                Section(header: Text("API Keys"), footer: Text("API keys are stored securely on your device.")) {
                    VStack(alignment: .leading, spacing: 8) {
                        Text("Merriam-Webster")
                            .font(.caption)
                            .foregroundColor(.secondary)
                        SecureField("API Key", text: $merriamWebsterKey)
                            .textFieldStyle(RoundedBorderTextFieldStyle())
                    }

                    VStack(alignment: .leading, spacing: 8) {
                        Text("OpenAI")
                            .font(.caption)
                            .foregroundColor(.secondary)
                        SecureField("API Key", text: $openAIKey)
                            .textFieldStyle(RoundedBorderTextFieldStyle())
                    }

                    Button("Save API Keys") {
                        saveAPIKeys()
                    }
                    .disabled(merriamWebsterKey.isEmpty && openAIKey.isEmpty)
                }

                // How to Use Section
                Section(header: Text("How to Use")) {
                    HStack {
                        Image(systemName: "hand.tap.fill")
                            .foregroundColor(.blue)
                            .frame(width: 24)
                        Text("Long-press any word on a webpage")
                    }

                    HStack {
                        Image(systemName: "square.and.arrow.up.fill")
                            .foregroundColor(.blue)
                            .frame(width: 24)
                        Text("Or use Share → Look up with Lex")
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

                    Link("Report an Issue", destination: URL(string: "https://github.com/anthropics/claude-code/issues")!)
                }
            }
            .navigationTitle("Lex Dictionary")
            .alert("Settings Saved", isPresented: $showingSavedAlert) {
                Button("OK", role: .cancel) { }
            }
        }
        .onAppear {
            loadAPIKeys()
        }
    }

    private func openSafariExtensionPreferences() {
        SFSafariApplication.showPreferencesForExtension(withIdentifier: "com.lex.Lex-Extension") { error in
            if let error = error {
                print("Failed to open Safari extension preferences: \(error)")
            }
        }
    }

    private func loadAPIKeys() {
        // Load from Keychain or UserDefaults
        merriamWebsterKey = KeychainHelper.load(key: "merriam_webster_api_key") ?? ""
        openAIKey = KeychainHelper.load(key: "openai_api_key") ?? ""
    }

    private func saveAPIKeys() {
        // Save to Keychain
        if !merriamWebsterKey.isEmpty {
            KeychainHelper.save(key: "merriam_webster_api_key", value: merriamWebsterKey)
        }
        if !openAIKey.isEmpty {
            KeychainHelper.save(key: "openai_api_key", value: openAIKey)
        }

        // Notify extension of updated settings
        notifyExtensionOfSettingsChange()

        showingSavedAlert = true
    }

    private func notifyExtensionOfSettingsChange() {
        // Send settings to extension via shared storage
        let userDefaults = UserDefaults(suiteName: "group.com.lex.shared")
        userDefaults?.set(merriamWebsterKey, forKey: "merriam_webster_api_key")
        userDefaults?.set(openAIKey, forKey: "openai_api_key")
    }
}

// Simple Keychain helper
struct KeychainHelper {
    static func save(key: String, value: String) {
        let data = value.data(using: .utf8)!
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrAccount as String: key,
            kSecValueData as String: data
        ]

        SecItemDelete(query as CFDictionary)
        SecItemAdd(query as CFDictionary, nil)
    }

    static func load(key: String) -> String? {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrAccount as String: key,
            kSecReturnData as String: true,
            kSecMatchLimit as String: kSecMatchLimitOne
        ]

        var result: AnyObject?
        let status = SecItemCopyMatching(query as CFDictionary, &result)

        guard status == errSecSuccess,
              let data = result as? Data,
              let value = String(data: data, encoding: .utf8) else {
            return nil
        }

        return value
    }
}

#Preview {
    SettingsView()
}
