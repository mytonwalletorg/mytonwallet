//
//  MTonConnectRequest.swift
//  WalletCore
//
//  Created by Sina on 8/14/24.
//

import Foundation

public struct MTonConnectRequest: Equatable, Hashable, Codable, Sendable {
    public struct Permissions: Equatable, Hashable, Codable, Sendable {
        public let address: Bool
        public let proof: Bool
        public init(dictionary: [String: Any]) {
            self.address = dictionary["address"] as? Bool ?? false
            self.proof = dictionary["proof"] as? Bool ?? false
        }
    }
    public let identifier: String
    public let promiseId: String
    public let dapp: ApiDapp
    public let permissions: Permissions
    public let proof: ApiTonConnectProof

    public init(dictionary: [String: Any]) {
        self.identifier = dictionary["identifier"] as? String ?? ""
        self.promiseId = dictionary["promiseId"] as? String ?? ""
        self.dapp = ApiDapp(dictionary: dictionary["dapp"] as? [String: Any] ?? [:])
        self.permissions = Permissions(dictionary: dictionary["permissions"] as? [String: Any] ?? [:])
        self.proof = ApiTonConnectProof(dictionary: dictionary["proof"] as? [String: Any] ?? [:])
    }

}
