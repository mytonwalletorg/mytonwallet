
import Foundation
import WalletContext

public struct ApiTonConnectProof: Equatable, Hashable, Codable, Sendable {
    public var timestamp: Int
    public var domain: String
    public var payload: String
    
    public init(dictionary: [String: Any]) {
        self.domain = dictionary["domain"] as? String ?? ""
        self.payload = dictionary["payload"] as? String ?? ""
        self.timestamp = dictionary["timestamp"] as? Int ?? 0
    }
}
