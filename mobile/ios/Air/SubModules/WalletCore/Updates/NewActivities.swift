
import WalletContext

extension ApiUpdate {
    public struct NewActivities: Equatable, Hashable, Sendable {
        public let type = "newActivities"
        public var accountId: String
        public var chain: ApiChain?
        public var activities: [ApiActivity]
//        public var noForward: Bool?

        public init(accountId: String, chain: ApiChain?, activities: [ApiActivity]) {
            self.accountId = accountId
            self.chain = chain
            self.activities = activities
        }
    }
}
