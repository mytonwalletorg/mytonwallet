//
//  Api+Dapp.swift
//  WalletCore
//
//  Created by Sina on 6/25/24.
//

import Foundation
import WebKit
import WalletContext

extension Api {
    
    public static func getActiveDapp(accountId: String) async throws -> String {
        try await bridge.callApi("getActiveDapp", accountId, decoding: String.self)
    }
    
    public static func deactivateDapp(origin: String) async throws -> Bool {
        try await bridge.callApi("deactivateDapp", origin, decoding: Bool.self)
    }
    
    public static func getDapps(accountId: String) async throws -> [ApiDapp] {
        try await bridge.callApi("getDapps", accountId, decoding: [ApiDapp].self)
    }
    
    public static func getDappsByOrigin(accountId: String) async throws -> [String: ApiDapp] {
        try await bridge.callApi("getDappsByOrigin", accountId, decoding: [String: ApiDapp].self)
    }
    
    /// - Important: Do not call this method directly, use **DappsStore** instead
    internal static func deleteDapp(accountId: String, url: String, dontNotifyDapp: Bool?) async throws -> Bool {
        try await bridge.callApi("deleteDapp", accountId, url, dontNotifyDapp, decoding: Bool.self)
    }
    
    internal static func deleteAllDapps(accountId: String) async throws {
        try await bridge.callApiVoid("deleteAllDapps", accountId)
    }
    
    public static func loadExploreSites(isLandscape: Bool = false) async throws -> ExploreSitesResult {
        struct Opts: Encodable {
            var isLandscape: Bool
        }
        return try await bridge.callApi("loadExploreSites", Opts(isLandscape: isLandscape), decoding: ExploreSitesResult.self)
    }
}


// MARK: - Types

extension Api {
    public struct ExploreSitesResult: Codable, Sendable {
        public var categories: [ApiSiteCategory]
        public var sites: [ApiSite]
    }
}
