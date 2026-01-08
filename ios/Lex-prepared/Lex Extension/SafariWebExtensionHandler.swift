import SafariServices
import os.log

class SafariWebExtensionHandler: NSObject, NSExtensionRequestHandling {
    func beginRequest(with context: NSExtensionContext) {
        let request = context.inputItems.first as? NSExtensionItem

        let profile: UUID?
        if #available(iOS 17.0, *) {
            profile = request?.userInfo?[SFExtensionProfileKey] as? UUID
        } else {
            profile = request?.userInfo?["profile"] as? UUID
        }

        let message: Any?
        if #available(iOS 15.0, *) {
            message = request?.userInfo?[SFExtensionMessageKey]
        } else {
            message = request?.userInfo?["message"]
        }

        os_log(.default, "Lex Extension received message from browser.runtime.sendNativeMessage: %{public}@",
               String(describing: message))

        // Handle messages from JavaScript
        if let messageDict = message as? [String: Any] {
            handleMessage(messageDict, context: context)
        } else {
            // Default response
            let response = NSExtensionItem()
            response.userInfo = [SFExtensionMessageKey: ["status": "ok"]]
            context.completeRequest(returningItems: [response], completionHandler: nil)
        }
    }

    private func handleMessage(_ message: [String: Any], context: NSExtensionContext) {
        let messageType = message["type"] as? String ?? ""

        switch messageType {
        case "GET_API_KEYS":
            // Retrieve API keys from shared storage
            let userDefaults = UserDefaults(suiteName: "group.com.lex.shared")
            let merriamWebsterKey = userDefaults?.string(forKey: "merriam_webster_api_key") ?? ""
            let openAIKey = userDefaults?.string(forKey: "openai_api_key") ?? ""

            let response = NSExtensionItem()
            response.userInfo = [
                SFExtensionMessageKey: [
                    "status": "ok",
                    "merriamWebsterKey": merriamWebsterKey,
                    "openAIKey": openAIKey
                ]
            ]
            context.completeRequest(returningItems: [response], completionHandler: nil)

        case "SAVE_SETTINGS":
            // Save settings from extension
            if let settings = message["settings"] as? [String: Any] {
                let userDefaults = UserDefaults(suiteName: "group.com.lex.shared")
                for (key, value) in settings {
                    userDefaults?.set(value, forKey: key)
                }
            }

            let response = NSExtensionItem()
            response.userInfo = [SFExtensionMessageKey: ["status": "ok"]]
            context.completeRequest(returningItems: [response], completionHandler: nil)

        default:
            let response = NSExtensionItem()
            response.userInfo = [SFExtensionMessageKey: ["status": "unknown_message_type"]]
            context.completeRequest(returningItems: [response], completionHandler: nil)
        }
    }
}
