//
//  MAccountBalanceData.swift
//  MyTonWalletAir
//
//  Created by Sina on 10/24/24.
//

public struct MAccountBalanceData {
    public let walletTokens: [MTokenBalance]
    public let totalBalance: Double
    public let totalBalanceYesterday: Double
}

extension MAccountBalanceData: CustomStringConvertible {
    public var description: String {
        let first = walletTokens.prefix(5).map { $0.tokenSlug }.joined(separator: ",")
        return "MAccountBalanceData<\(totalBalance.rounded(decimals: 2)) tokens#=\(walletTokens.count) \(first)>"
    }
}
