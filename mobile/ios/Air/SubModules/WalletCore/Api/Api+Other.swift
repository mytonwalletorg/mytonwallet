//
//  Api+Other.swift
//  WalletCore
//
//  Created by Sina on 11/6/24.
//

import Foundation
import WalletContext

extension Api {

    public static func setIsAppFocused(_ isFocused: Bool) {
        shared?.webViewBridge.callApi(methodName: "setIsAppFocused", args: [AnyEncodable(isFocused)]) { res in
        }
        WalletCoreData.notify(event: .forceReload, for: nil)
        if isFocused{
            WalletCoreData.notify(event: .applicationWillEnterForeground)
        } else {
            WalletCoreData.notify(event: .applicationDidEnterBackground)
        }
    }
    
    public static func ping() async throws -> Bool {
        try await bridge.callApi("ping", decoding: Bool.self)
    }

    public static func getMoonpayOnrampUrl(chain: ApiChain, address: String, activeTheme: NightMode, callback: @escaping (Result<String, BridgeCallError>) -> Void) {
        shared?.webViewBridge.callApi(methodName: "getMoonpayOnrampUrl", args: [
            AnyEncodable(chain),
            AnyEncodable(address),
            AnyEncodable(activeTheme)
        ], callback: { res in
            DispatchQueue.main.async {
                switch res {
                case .success(let successData):
                    if let data = successData as? [String: Any], let url = data["url"] as? String {
                        callback(.success(url))
                    } else {
                        callback(.failure(.unknown()))
                    }
                case .failure(let failure):
                    callback(.failure(failure))
                }
            }
        })
    }
}
