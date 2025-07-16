//
//  Api+Stake.swift
//  WalletCore
//
//  Created by Sina on 5/13/24.
//

import Foundation
import WalletContext

extension Api {
    
    public static func checkStakeDraft(accountId: String, amount: BigInt, state: ApiStakingState) async throws -> MTransactionDraft {
        try await bridge.callApi("checkStakeDraft", accountId, amount, state, decoding: MTransactionDraft.self)
    }
    
    public static func checkUnstakeDraft(accountId: String, amount: BigInt, state: ApiStakingState) async throws -> MTransactionDraft {
        try await bridge.callApi("checkUnstakeDraft", accountId, amount, state, decoding: MTransactionDraft.self)
    }

    public static func submitStake(accountId: String, password: String, amount: BigInt, state: ApiStakingState, realFee: BigInt?) async throws -> String {
        try await bridge.callApi("submitStake", accountId, password, amount, state, realFee, decoding: LocalTransactionResult.self).txId
    }
    
    public static func submitUnstake(accountId: String, password: String, amount: BigInt, state: ApiStakingState, realFee: BigInt?) async throws -> String {
        try await bridge.callApi("submitUnstake", accountId, password, amount, state, realFee, decoding: LocalTransactionResult.self).txId
    }

    public static func getStakingHistory(accountId: String, limit: Int, offset: Int) async throws -> [ApiStakingHistory] {
        try await bridge.callApi("getStakingHistory", accountId, limit, offset, decoding: [ApiStakingHistory].self)
    }
    
    public static func submitStakingClaim(accountId: String, password: String, state: ApiStakingStateJetton, realFee: BigInt?) async throws -> String {
        try await bridge.callApi("submitStakingClaim", accountId, password, state, realFee, decoding: LocalTransactionResult.self).txId
    }
}


// MARK: - Types

fileprivate struct LocalTransactionResult: Decodable {
    let txId: String
}

