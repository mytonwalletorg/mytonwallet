
import UIKit
import WalletContext


public struct ApiTransactionActivity: BaseActivity, Codable, Equatable, Hashable, Sendable {
    
    public let id: String
    public var kind: String = "transaction"
    public var shouldLoadDetails: Bool?
    public var extra: BaseActivityExtra?

    public let txId: String
    public let timestamp: Int64
    /** The amount to show in the UI (may mismatch the actual attached TON amount */
    public let amount: BigInt
    public let fromAddress: String
    public let toAddress: String?
    public let comment: String?
    public let encryptedComment: String?
    /** The fee to show in the UI (not the same as the network fee) */
    public let fee: BigInt
    public let slug: String
    public let isIncoming: Bool
    public let normalizedAddress: String?
    public let externalMsgHash: String?
    public let shouldHide: Bool?
    public let type: ApiTransactionType?
    public let metadata: MAddressInfo?
    public let nft: ApiNft?
    
    public init(id: String, kind: String, shouldLoadDetails: Bool? = nil, extra: BaseActivityExtra? = nil, txId: String, timestamp: Int64, amount: BigInt, fromAddress: String, toAddress: String?, comment: String?, encryptedComment: String?, fee: BigInt, slug: String, isIncoming: Bool, normalizedAddress: String?, externalMsgHash: String?, shouldHide: Bool?, type: ApiTransactionType?, metadata: MAddressInfo?, nft: ApiNft?) {
        self.id = id
        self.kind = kind
        self.shouldLoadDetails = shouldLoadDetails
        self.extra = extra
        self.txId = txId
        self.timestamp = timestamp
        self.amount = amount
        self.fromAddress = fromAddress
        self.toAddress = toAddress
        self.comment = comment
        self.encryptedComment = encryptedComment
        self.fee = fee
        self.slug = slug
        self.isIncoming = isIncoming
        self.normalizedAddress = normalizedAddress
        self.externalMsgHash = externalMsgHash
        self.shouldHide = shouldHide
        self.type = type
        self.metadata = metadata
        self.nft = nft
    }
    
    public var isStaking: Bool {
        type == .stake ||
        type == .unstake ||
        type == .unstakeRequest
    }
}

public extension ApiTransactionActivity {
    var addressToShow: String {
        metadata?.name ?? (isIncoming ? fromAddress : toAddress) ?? ""
    }
}

public struct MAddressInfo: Equatable, Hashable, Codable, Sendable {
    public let name: String?
    public let isScam: Bool?
    public let isMemoRequired: Bool?
    
    public init(name: String?, isScam: Bool?, isMemoRequired: Bool?) {
        self.name = name
        self.isScam = isScam
        self.isMemoRequired = isMemoRequired
    }
}
