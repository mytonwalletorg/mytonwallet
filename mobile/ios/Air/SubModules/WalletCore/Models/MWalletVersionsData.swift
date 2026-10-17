//
//  MWalletVersionsData.swift
//  WalletCore
//
//  Created by Sina on 7/14/24.
//

import Foundation
import WalletContext

public struct MWalletVersionsData: Sendable {
    
    public struct Version: Identifiable, Sendable {
        public struct ID: Hashable, Sendable {
            public let address: String
            public let version: String
        }

        public var id: ID { ID(address: address, version: version) }
        public let address: String
        public let balance: BigInt
        public let isInitialized: Bool
        public let version: String
        public let isTestnetSubwalletId: Bool?

        public init(dictionary: [String: Any]) {
            self.address = dictionary["address"] as? String ?? ""
            if let balance = (dictionary["balance"] as? String)?.components(separatedBy: "bigint:")[1] {
                self.balance = BigInt(balance) ?? 0
            } else {
                self.balance = 0
            }
            self.isInitialized = dictionary["isInitialized"] as? Bool ?? false
            self.version = dictionary["version"] as? String ?? ""
            self.isTestnetSubwalletId = dictionary["isTestnetSubwalletId"] as? Bool
        }
    }
    
    public let currentVersion: String?
    public let versions: [Version]

    public init(dictionary: [String: Any]) {
        self.currentVersion = dictionary["currentVersion"] as? String
        var seen = Set<Version.ID>()
        // Testnet can have two W5 wallets with different subwallet IDs and addresses.
        self.versions = (dictionary["versions"] as? [[String: Any]] ?? [])
            .map { Version(dictionary: $0) }
            .filter { seen.insert($0.id).inserted }
    }

}
