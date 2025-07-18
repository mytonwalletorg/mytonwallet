
import Foundation
import WebKit
import WalletContext

extension Api {
    
    public static func submitTransfer(chain: ApiChain, options: Api.SubmitTransferOptions, shouldCreateLocalActivity: Bool? = nil) async throws -> ApiSubmitTransferResult {
        print(options)
        return try await bridge.callApi("submitTransfer", chain, options, shouldCreateLocalActivity, decoding: ApiSubmitTransferResult.self)
    }
    
    public static func fetchAllActivitySlice(accountId: String, limit: Int, toTimestamp: Int64?, tronTokenSlugs: [String]) async throws -> [ApiActivity] {
        
        let toTimestamp = toTimestamp ?? Int64(Date.now.timeIntervalSince1970 * 1000)
        
        let start = Date()
        Log.api.info("fetchAllActivitySlice \(accountId, .public) \(limit) \(toTimestamp as Any, .public)")
        let data = try await bridge.callApiRaw("fetchAllActivitySlice", accountId, limit, toTimestamp, tronTokenSlugs)
        if let arr = data as? [[String: Any]] {
            Log.api.info("fetchAllActivitySlice \(accountId, .public) \(limit) \(toTimestamp as Any, .public) result \(arr.count) in \(Date().timeIntervalSince(start))")
            let transactions: [ApiActivity] = arr.compactMap { dict in
                do {
                    return try ApiActivity(dictionary: dict)
                } catch {
//                    assertionFailure()
                    return nil
                }
            }
            return transactions
        } else {
            let err = try ((data as? [String: Any])?["error"] as? String).orThrow()
            throw BridgeCallError.apiReturnedError(error: err, data: data as Any)
        }
    }
    
    // fetch a specific slug
    public static func fetchActivitySlice(
        accountId: String, chain: ApiChain, slug: String, fromTimestamp: Int64?, toTimestamp: Int64?, limit: Int
    ) async throws -> [ApiActivity] {
        
        let data = try await bridge.callApiRaw("fetchActivitySlice", accountId, chain, slug, toTimestamp, limit, fromTimestamp)
        if let arr = data as? [[String: Any]] {
            let transactions: [ApiActivity] = arr.compactMap { dict in
                do {
                    return try ApiActivity(dictionary: dict)
                } catch {
                    assertionFailure()
                    return nil
                }
            }
            return transactions
        } else {
            let err = try ((data as? [String: Any])?["error"] as? String).orThrow()
            throw BridgeCallError.apiReturnedError(error: err, data: data as Any)
        }
    }
    
    /// - Important: call through ActivityStore
    internal static func fetchTonActivityDetails(accountId: String, activity: ApiActivity) async throws -> ApiActivity {
        try await bridge.callApi("fetchTonActivityDetails", accountId, activity, decoding: ApiActivity.self)
    }
    
    public static func signTransactions(accountId: String, messages: [ApiTransferToSign], options: ApiSignLedgerTransactionsOptions?) async throws -> [ApiSignedTransfer] {
        try await bridge.callApi("signTransactions", accountId, messages, options, decoding: [ApiSignedTransfer].self)
    }
    
    public static func decryptComment(accountId: String, encryptedComment: String, fromAddress: String, password: String) async throws -> String {
        try await bridge.callApi("decryptComment", accountId, encryptedComment, fromAddress, password, decoding: String.self)
    }
    
    public static func checkTransactionDraft(chain: String, options: CheckTransactionDraftOptions) async throws -> MTransactionDraft {
        do {
            return try await bridge.callApi("checkTransactionDraft", chain, options, decoding: MTransactionDraft.self)
        } catch {
            if let bridgeError = error as? BridgeCallError, case .message(_, let data) = bridgeError, let data {
                return try JSONSerialization.decode(MTransactionDraft.self, from: data)
            }
            throw error
        }
    }
    
    // MARK: Callback methods
    
    /// - Note: `shouldCreateLocalTransaction = true`
    public static func submitTransfer(chain: String,
                                      options: SubmitTransferOptions,
                                      callback: @escaping (Result<(String), BridgeCallError>) -> Void) {
        shared?.webViewBridge.callApi(methodName: "submitTransfer", args: [
            AnyEncodable(chain),
            AnyEncodable(options),
        ]) { result in
            switch result {
            case .success(let response):
                callback(.success((response as? [String: Any])?["txId"] as? String ?? ""))
            case .failure(let failure):
                callback(.failure(failure))
            }
        }
    }
}


// MARK: - Types

public struct ApiSubmitTransferResult: Decodable, Sendable {
    public var txId: String
}

public struct ApiSignLedgerTransactionsOptions: Encodable {
    public var validUntil: Int?
    public var vestingAddress: String?
    
    public init(validUntil: Int?, vestingAddress: String?) {
        self.validUntil = validUntil
        self.vestingAddress = vestingAddress
    }
}
