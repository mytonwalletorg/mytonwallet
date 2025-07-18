
import UIKit
import WalletContext

public struct ApiSwapActivity: BaseActivity, Codable, Equatable, Hashable, Sendable {
    
    public let id: String
    public var kind: String = "swap"
    public var shouldLoadDetails: Bool?
    public var externalMsgHash: String?
    public var extra: BaseActivityExtra?
    
    public let shouldHide: Bool?
    public let timestamp: Int64
    public let lt: Int64?
    public let from: String
    public let fromAmount: MDouble
    public let to: String
    public let toAmount: MDouble
    public let networkFee: MDouble? // FIXME: Had to add ? for comatibility
    public let swapFee: MDouble? // FIXME: Had to add ? for comatibility
    public let ourFee: MDouble?
    public let status: ApiSwapStatus
    public let hashes: [String]?
    public let isCanceled: Bool?
    public let cex: ApiSwapCexTransaction?
}

public enum ApiSwapStatus: String, Codable, Sendable {
    case pending
    case completed
    case failed
    case expired
}

public struct ApiSwapCexTransaction: Codable, Equatable, Hashable, Sendable {
    public let payinAddress: String
    public let payoutAddress: String
    public let payinExtraId: String?
    public let status: ApiSwapCexTransactionStatus
    public let transactionId: String
}

public enum ApiSwapCexTransactionStatus: String, Codable, Sendable {
    case new
    case waiting
    case confirming
    case exchanging
    case sending
    case finished
    case failed
    case refunded
    case hold
    case overdue
    case expired
    
    // FIXME: added for compatibility
    case pending
    
    public enum UIStatus: Codable, Sendable {
        case waiting
        case pending
        case expired
        case failed
        case completed
    }
    public var uiStatus: UIStatus {
        switch self {
        case .new, .waiting, .confirming, .exchanging, .sending, .hold:
            return .pending
        case .expired, .refunded, .overdue:
            return .expired
        case .failed:
            return .failed
        case .finished:
            return .completed
        default:
            return .pending
        }
    }
}

public extension ApiSwapActivity {
    var fromToken: ApiToken? {
        TokenStore.getToken(slugOrAddress: from)
    }
    
    var toToken: ApiToken? {
        TokenStore.getToken(slugOrAddress: to)
    }
    
    var fromAmountInt64: BigInt? {
        doubleToBigInt(fromAmount.value, decimals: fromToken?.decimals ?? 9)
    }
    
    var toAmountInt64: BigInt? {
        doubleToBigInt(toAmount.value, decimals: toToken?.decimals ?? 9)
    }
    
    var fromSymbolName: String {
        fromToken?.symbol ?? ""
    }
    
    var toSymbolName: String {
        toToken?.symbol ?? ""
    }
    
    var swapType: SwapType {
        fromToken?.isOnChain == false ? .crossChainToTon : toToken?.isOnChain == false ? .crossChainFromTon : .inChain
    }
}
