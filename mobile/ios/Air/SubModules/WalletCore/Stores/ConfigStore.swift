//
//  ConfigStore.swift
//  MyTonWalletAir
//
//  Created by Sina on 11/6/24.
//

import Foundation
public class ConfigStore {
    
    public struct Config {
        let isCopyStorageEnabled: Bool?
        let supportAccountsCount: Bool?
        let isLimited: Bool?
        public let countryCode: String?
        
        public init(dictionary: [String: Any]) {
            self.isCopyStorageEnabled = dictionary["isCopyStorageEnabled"] as? Bool
            self.supportAccountsCount = dictionary["supportAccountsCount"] as? Bool
            self.isLimited = dictionary["isLimited"] as? Bool
            self.countryCode = dictionary["countryCode"] as? String
        }
        
    }
    
    private init() {}
    
    private static let queue = DispatchQueue(label: "org.mytonwallet.app.config_store", attributes: .concurrent)
    
    private static var _config: Config? = nil
    public internal(set) static var config: Config? {
        get {
            return queue.sync { _config }
        }
        set {
            queue.async(flags: .barrier) { _config = newValue }
        }
    }
    
    public static func clean() {
        queue.async(flags: .barrier) {
            _config = nil
        }
    }
}
