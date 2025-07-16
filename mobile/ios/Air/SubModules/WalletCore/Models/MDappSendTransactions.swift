
import Foundation
import WalletContext

public struct MDappSendTransactions: Equatable, Hashable, Decodable, Sendable {
    
    public var promiseId: String
    public var accountId: String
    public var dapp: ApiDapp
    public var transactions: [ApiDappTransfer]
    public var activities: [ApiActivity]?
    public var fee: BigInt?
    public var vestingAddress: String?
    public var validUntil: Int?
    
    public init(promiseId: String, accountId: String, dapp: ApiDapp, transactions: [ApiDappTransfer], activities: [ApiActivity]? = nil, fee: BigInt? = nil, vestingAddress: String? = nil, validUntil: Int? = nil) {
        self.promiseId = promiseId
        self.accountId = accountId
        self.dapp = dapp
        self.transactions = transactions
        self.activities = activities
        self.fee = fee
        self.vestingAddress = vestingAddress
        self.validUntil = validUntil
    }
    
    enum CodingKeys: CodingKey {
        case promiseId
        case accountId
        case dapp
        case transactions
        case activities
        case fee
        case vestingAddress
        case validUntil
    }
    
    public init(from decoder: any Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        self.promiseId = try container.decode(String.self, forKey: .promiseId)
        self.accountId = try container.decode(String.self, forKey: .accountId)
        self.dapp = try container.decode(ApiDapp.self, forKey: .dapp)
        self.transactions = try container.decode([ApiDappTransfer].self, forKey: .transactions)
        self.activities = try container.decodeIfPresent([ApiActivity].self, forKey: .activities)
        self.fee = try? container.decodeIfPresent(BigInt.self, forKey: .fee)
        self.vestingAddress = try? container.decodeIfPresent(String.self, forKey: .vestingAddress)
        self.validUntil = try? container.decodeIfPresent(Int.self, forKey: .validUntil)
    }
}


public struct ApiDappTransfer: ApiTransferToSignProtocol, Equatable, Hashable, Decodable, Sendable {
    
    public var toAddress: String
    public var amount: BigInt
    public var rawPayload: String?
    public var payload: MParsedPayload?
    public var stateInit: String?

    public var isScam: Bool?
    /** Whether the transfer should be treated with cautiousness, because its payload is unclear */
    public var isDangerous: Bool
    public var normalizedAddress: String
    /** The transfer address to show in the UI */
    public var displayedToAddress: String
    public var networkFee: BigInt
}

