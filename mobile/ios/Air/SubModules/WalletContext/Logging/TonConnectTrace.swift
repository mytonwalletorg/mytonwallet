import Foundation

#if DEBUG
private let log = Log("TonConnectTrace")
#endif

/// Debug builds trace the TON Connect flow from the incoming deeplink to the request UI: the SDK bridge lifecycle,
/// the SSE bridge connection inside the SDK page, and the updates that native code handles. Lines go to the log
/// overlay (Debug menu → Display log overlay) and to the log file. Release builds record nothing.
public enum TonConnectTrace {

    /// Marks SDK console lines that the SDK page's trace script writes.
    public static let consoleLinePrefix = "[tc-trace] "

    private static let consoleLineMarkers = ["tonConnect", "DappProtocolManager", "/bridge/message"]
    /// The bridge logs each SDK call as its bare method name.
    private static let apiCallPrefixes = ["signDapp", "confirmDappRequest", "cancelDappRequest"]

    public static func record(_ message: @autoclosure () -> String) {
        #if DEBUG
        let message = message()
        log.info("\(message, .public)")
        displayLog("TC \(message)")
        #endif
    }

    /// Shows an SDK console line in the overlay when it belongs to the TON Connect flow. The bridge already writes
    /// every console line to the log file.
    public static func recordConsoleLine(_ line: String) {
        #if DEBUG
        if line.hasPrefix(consoleLinePrefix) {
            displayLog("TC \(line.dropFirst(consoleLinePrefix.count))")
        } else if consoleLineMarkers.contains(where: line.contains) || apiCallPrefixes.contains(where: line.hasPrefix) {
            // An SDK log line can end with a dump of the request it handles; the overlay keeps only the text before it
            let summary = line.prefix { $0 != "{" && $0 != "(" }.trimmingCharacters(in: .whitespaces)
            displayLog("TC js \(summary)")
        }
        #endif
    }

    /// A TON Connect link without its connect request payload, and with its return URL reduced to scheme and host.
    public static func describeLink(_ link: String) -> String {
        guard let components = URLComponents(string: link) else { return "<unparsed link>" }
        let queryItems = components.queryItems ?? []
        func value(_ name: String) -> String? {
            queryItems.first { $0.name == name }?.value
        }
        let kind = value("r") == nil ? "request wake-up" : "connect"
        let clientId = value("id").map { "\($0.prefix(8))…" } ?? "none"
        let returnTarget = value("ret").map(describeReturnTarget) ?? "back (default)"
        return "\(components.scheme ?? "?")://\(components.host ?? "") \(kind) id=\(clientId) ret=\(returnTarget)"
    }

    /// A dApp's return target as `back`, `none`, or only the scheme and host of its URL: the rest can carry tokens.
    public static func describeReturnTarget(_ value: String) -> String {
        if value == "back" || value == "none" {
            return value
        }
        return describeURL(value)
    }

    /// Only the scheme and host of a URL; its path and query can carry tokens.
    public static func describeURL(_ value: String) -> String {
        guard let components = URLComponents(string: value), let scheme = components.scheme else {
            return "<not a URL>"
        }
        return "\(scheme)://\(components.host ?? "")"
    }
}
