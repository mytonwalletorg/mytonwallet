//
//  ApiActivity.swift
//  WalletCore
//
//  Created by Sina on 3/20/24.
//

import UIKit
import WalletContext


public protocol BaseActivity: Identifiable {
    var id: String { get }
    var shouldHide: Bool? { get }

    /// Only for TON
    var externalMsgHash: String? { get }

    /// Whether more details should be loaded by calling the `fetchTonActivityDetails` action. Undefined means "no".
    var shouldLoadDetails: Bool? { get }

    var extra: BaseActivityExtra? { get }
}

public struct BaseActivityExtra: Equatable, Hashable, Codable, Sendable {
    /// Only for TON
    public var withW5Gasless: Bool?
}


// MARK: - ApiActivity


public enum ApiActivity: Equatable, Hashable, Codable, Sendable {
    case transaction(ApiTransactionActivity)
    case swap(ApiSwapActivity)

    enum CodingKeys: String, CodingKey {
        case kind
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let kind = try container.decode(String.self, forKey: .kind)
        switch kind {
        case "transaction":
            self = try .transaction(.init(from: decoder))
        case "swap":
            self = try .swap(.init(from: decoder))
        default:
            throw DecodingError.dataCorruptedError(forKey: .kind, in: container, debugDescription: "Unknown activity type: \(kind)")
        }
    }

    public func encode(to encoder: any Encoder) throws {
        switch self {
        case .transaction(let transaction):
            try transaction.encode(to: encoder)
        case .swap(let swap):
            try swap.encode(to: encoder)
        }
    }
}

public enum ApiTransactionType: String, Codable, Sendable {
    case stake
    case unstake
    case unstakeRequest
    case callContract
    case excess
    case contractDeploy
    case bounced
    case mint
    case burn
    case auctionBid
    case nftTrade
    case dnsChangeAddress
    case dnsChangeSite
    case dnsChangeSubdomains
    case dnsChangeStorage
    case dnsDelete
    case dnsRenew
    case liquidityDeposit
    case liquidityWithdraw
    
    @available(*, deprecated)
    case nftPurchase
    @available(*, deprecated)
    case nftReceived
    @available(*, deprecated)
    case nftTransferred
    
    case swap
}

public extension ApiActivity {
    init(dictionary: [String: Any]) throws {
        self = try JSONSerialization.decode(ApiActivity.self, from: dictionary)
    }
    
    var toDictionary: [String: Any] {
        let data = try! JSONSerialization.encode(self)
        return data as! [String: Any]
    }
}

public extension ApiActivity {
    
    enum Kind {
        case transaction
        case swap
    }
    var kind: Kind {
        switch self {
        case .transaction: .transaction
        case .swap: .swap
        }
    }
    
    var transaction: ApiTransactionActivity? {
        if case .transaction(let tx) = self { tx } else { nil }
    }
    var swap: ApiSwapActivity? {
        if case .swap(let swap) = self { swap } else { nil }
    }
}

public extension ApiActivity {
    var id: String {
        switch self {
        case .transaction(let transaction): transaction.id
        case .swap(let swap): swap.id
        }
    }

    var shouldHide: Bool? {
        switch self {
        case .transaction(let transaction): transaction.shouldHide
        case .swap(let swap): swap.shouldHide
        }
    }

    var timestamp: Int64 {
        switch self {
        case .transaction(let transaction): transaction.timestamp
        case .swap(let swap): swap.timestamp
        }
    }
    
    var slug: String {
        switch self {
        case .transaction(let transaction): transaction.slug
        case .swap(let swap): swap.from
        }
    }
    
    var type: ApiTransactionType? {
        switch self {
        case .transaction(let transaction): transaction.type
        case .swap: .swap
        }
    }

    var txId: String? {
        switch self {
        case .transaction(let transaction): transaction.txId
        case .swap(let swap): swap.hashes?.first
        }
    }
}

extension ApiActivity: Comparable {
    public static func < (lhs: ApiActivity, rhs: ApiActivity) -> Bool {
        if lhs.timestamp != rhs.timestamp {
            return lhs.timestamp > rhs.timestamp
        }
        return lhs.id > rhs.id
    }
}

extension ApiActivity: BaseActivity {
    
    public var externalMsgHash: String? {
        switch self {
        case .transaction(let transaction): transaction.externalMsgHash
        case .swap(let swap): swap.externalMsgHash
        }
    }
    
    public var shouldLoadDetails: Bool? {
        switch self {
        case .transaction(let transaction): transaction.shouldLoadDetails
        case .swap(let swap): swap.shouldLoadDetails
        }
    }
    
    public var extra: BaseActivityExtra? {
        switch self {
        case .transaction(let transaction): transaction.extra
        case .swap(let swap): swap.extra
        }
    }
}

extension ApiActivity {
    
    public func extractAddress() -> String? {
        if case .transaction(let transaction) = self {
            if transaction.isIncoming {
                return transaction.fromAddress
            } else {
                return transaction.toAddress
            }
        }
        return nil
    }
    
    public var isLocal: Bool {
        return id.hasSuffix(":local")
    }
    
    public var isBackendSwapId: Bool {
        return id.hasSuffix(":backend-swap")
    }

    public var transactionHash: String? {
        let chain = TokenStore.chainForTokenSlug(slug)
        switch chain {
        case .ton:
            if let last = txId?.split(separator: ":").last {
                return String(last)
            }
            return txId
        case .tron:
            if let txId, let localIdSign = txId.firstIndex(of: "|") {
                return String(txId[..<localIdSign])
            }
            return txId
        case nil:
            return nil
        }
    }
}

public struct ParsedTxId {
    public var hash: String
    public var subId: String?
    public var type: UnusualTxType?
}

public enum UnusualTxType: String {
    case backendSwap = "backend-swap"
    case local = "local"
    case additional = "additional"
}

extension ApiActivity {
    /// see: src/util/acitivities/index.ts > parseTxId
    public var parsedTxId: ParsedTxId {
        var hash: String = ""
        var subId: String? = nil
        var type: UnusualTxType? = nil
        
        let split = id.split(separator: ":", omittingEmptySubsequences: false)
        if split.count > 0 {
            hash = String(split[0])
        }
        if split.count > 1 {
            subId = String(split[1])
        }
        if split.count > 2 {
            type = UnusualTxType(rawValue: String(split[2]))
        }
        return ParsedTxId(hash: hash, subId: subId, type: type)
    }
}
