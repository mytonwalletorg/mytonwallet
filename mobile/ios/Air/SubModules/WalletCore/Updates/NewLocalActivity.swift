
import WalletContext

extension ApiUpdate {
    public struct NewLocalActivity: Equatable, Hashable, Sendable {
        public let type = "newLocalActivity"
        public var accountId: String
        public var activity: ApiActivity
        
        public init(accountId: String, activity: ApiActivity) {
            self.accountId = accountId
            self.activity = activity
        }
    }
}
