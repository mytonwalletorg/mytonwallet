//
//  MDapp.swift
//  WalletCore
//
//  Created by Sina on 8/14/24.
//

import Foundation


public struct MSseOptions: Equatable, Hashable, Codable, Sendable {
    public let appClientId: String
    public let clientId: String
    public let secretKey: String
    public let lastOutputId: Int
    
    public init(dictionary: [String: Any]) {
        appClientId = dictionary["appClientId"] as? String ?? ""
        clientId = dictionary["clientId"] as? String ?? ""
        secretKey = dictionary["secretKey"] as? String ?? ""
        lastOutputId = dictionary["lastOutputId"] as? Int ?? 0
    }
}


public struct ApiDapp: Equatable, Hashable, Codable, Sendable {
    
    public let url: String
    public let name: String
    public let iconUrl: String
    public let manifestUrl: String
    
    public let connectedAt: Int?
    public let isUrlEnsured: Bool?
    public let sse: MSseOptions?
    
    public init(dictionary: [String: Any]) {
        url = dictionary["url"] as? String ?? ""
        name = dictionary["name"] as? String ?? ""
        iconUrl = dictionary["iconUrl"] as? String ?? ""
        manifestUrl = dictionary["manifestUrl"] as? String ?? ""
        
        connectedAt = dictionary["connectedAt"] as? Int ?? 0
        isUrlEnsured = dictionary["isUrlEnsured"] as? Bool
        sse = if let sse = dictionary["sse"] as? [String: Any] {
             MSseOptions(dictionary: sse)
        } else {
            nil
        }
    }
}


// MARK: Sample data

#if DEBUG
public extension ApiDapp {
    static let sample = ApiDapp(dictionary: [
        "iconUrl": "https://static.mytonwallet.org/explore-icons/mtwcards.webp",
        "name": "Sample name",
    ])
    
    static let sampleList: [ApiDapp] = [
        ApiDapp(dictionary: [
            "url": "https://static.mytonwallet.org/explore-icons/mtwcards.webp#0",
            "iconUrl": "https://static.mytonwallet.org/explore-icons/mtwcards.webp#0",
            "name": "Sample 1",
        ]),
        ApiDapp(dictionary: [
            "url": "https://static.mytonwallet.org/explore-icons/mtwcards.webp#1",
            "iconUrl": "https://static.mytonwallet.org/explore-icons/mtwcards.webp#1",
             "name": "Sample 2",
        ]),
        ApiDapp(dictionary: [
            "url": "https://static.mytonwallet.org/explore-icons/mtwcards.webp#2",
            "iconUrl": "https://static.mytonwallet.org/explore-icons/mtwcards.webp#2",
            "name": "Sample 3",
        ]),
        ApiDapp(dictionary: [
            "url": "https://static.mytonwallet.org/explore-icons/mtwcards.webp#3",
            "iconUrl": "https://static.mytonwallet.org/explore-icons/mtwcards.webp#3",
            "name": "Sample 4",
        ]),
        ApiDapp(dictionary: [
            "url": "https://static.mytonwallet.org/explore-icons/mtwcards.webp#4",
            "iconUrl": "https://static.mytonwallet.org/explore-icons/mtwcards.webp#4",
            "name": "Sample 5",
        ]),
        ApiDapp(dictionary: [
            "url": "https://static.mytonwallet.org/explore-icons/mtwcards.webp#5",
            "iconUrl": "https://static.mytonwallet.org/explore-icons/mtwcards.webp#5",
            "name": "Sample 6",
        ]),
    ]
}
#endif
