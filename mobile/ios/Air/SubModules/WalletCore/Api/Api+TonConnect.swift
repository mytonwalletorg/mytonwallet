//
//  Api+TC.swift
//  WalletCore
//
//  Created by Sina on 8/29/24.
//

import Foundation
import WalletContext

extension Api {
    
    static var _lastTonConnectRequestId = 0
    public static var tonConnectRequestId: Int {
        _lastTonConnectRequestId += 1
        return _lastTonConnectRequestId
    }
    
    public static func tonConnect_connect(
        dapp: DappArg,
        request: [String: Any],
        callback: @escaping (Result<Any?, BridgeCallError>) -> Void
    ) {
        shared?.webViewBridge.callApi(
            methodName: "tonConnect_connect",
            args: [
                AnyEncodable(dapp),
                AnyEncodable(dict: request),
                AnyEncodable(tonConnectRequestId),
            ]) { res in
                switch res {
                case .success(let success):
                    if var dict = success as? [String: Any],
                       let event = dict["event"] as? String,
                       event == "connect",
                       var payload = dict["payload"] as? [String: Any] {
                        payload["device"] = deviceInfo
                        dict["payload"] = payload
                        callback(.success(dict))
                        return
                    }
                    break
                case .failure(_):
                    break
                }
                callback(res)
            }
    }
    
    public static func tonConnect_reconnect(
        dapp: DappArg,
        callback: @escaping (Result<Any?, BridgeCallError>) -> Void
    ) {
        shared?.webViewBridge.callApi(
            methodName: "tonConnect_reconnect",
            args: [
                AnyEncodable(dapp),
                AnyEncodable(tonConnectRequestId),
            ]) { res in
                switch res {
                case .success(let success):
                    if var dict = success as? [String: Any],
                       let event = dict["event"] as? String,
                       event == "connect",
                       var payload = dict["payload"] as? [String: Any] {
                        payload["device"] = deviceInfo
                        dict["payload"] = payload
                        callback(.success(dict))
                        return
                    }
                    break
                case .failure(_):
                    break
                }
                callback(res)
            }
    }
    
    public static func tonConnect_disconnect(
        dapp: DappArg,
        callback: @escaping (Result<Any?, BridgeCallError>) -> Void
    ) {
        shared?.webViewBridge.callApi(
            methodName: "tonConnect_disconnect",
            args: [
                AnyEncodable(dapp),
                AnyEncodable(dict: [
                    "id": tonConnectRequestId,
                    "method": "disconnect",
                    "params": []
                ]),
            ]) { res in
                switch res {
                case .success(let success):
                    if var dict = success as? [String: Any],
                       let event = dict["event"] as? String,
                       event == "connect",
                       var payload = dict["payload"] as? [String: Any] {
                        payload["device"] = deviceInfo
                        dict["payload"] = payload
                        callback(.success(dict))
                        return
                    }
                    break
                case .failure(_):
                    break
                }
                callback(res)
            }
    }
    
    public struct ApiDappRequest: Hashable, Codable {
        var url: String?
        var isUrlEnsured: Bool?
        var accountId: String?
        var identifier: String?
        var sseOptions: ApiSseOptions?
        
        public init(url: String?, isUrlEnsured: Bool?, accountId: String?, identifier: String?, sseOptions: ApiSseOptions?) {
            self.url = url
            self.isUrlEnsured = isUrlEnsured
            self.accountId = accountId
            self.identifier = identifier
            self.sseOptions = sseOptions
        }
    }
    
    public struct ApiSseOptions: Hashable, Codable {
        let clientId: String
        let appClientId: String
        let secretKey: String
        let lastOutputId: Int
        
        public init(clientId: String, appClientId: String, secretKey: String, lastOutputId: Int) {
            self.clientId = clientId
            self.appClientId = appClientId
            self.secretKey = secretKey
            self.lastOutputId = lastOutputId
        }
    }
        
    public struct SendTransactionRpcRequest: Hashable, Codable {
        let method: String
        let params: [String]
        let id: String
        
        public init(method: String, params: [String], id: String) {
            self.method = method
            self.params = params
            self.id = id
        }
    }
    
    public struct SendTransactionRpcResponseSuccess: Decodable {
        public let id: String
        public let result: String
    }
    
    public struct SendTransactionRpcResponseError: Error, Decodable {
        public struct ErrorInfo: Decodable {
            public var code: Int
            public var message: String
        }
        public var error: ErrorInfo
        public var id: String
    }
    
    public static func tonConnect_sendTransaction(
        request: ApiDappRequest,
        message: SendTransactionRpcRequest
    ) async throws -> SendTransactionRpcResponseSuccess {
        let result = try await bridge.callApiRaw("tonConnect_sendTransaction", request, message)
        guard let result else { throw NilError() }
        let data = try JSONSerialization.data(withJSONObject: result)
        do {
            let value = try JSONDecoder().decode(SendTransactionRpcResponseSuccess.self, from: data)
            return value
        } catch {
            let error = try JSONDecoder().decode(SendTransactionRpcResponseError.self, from: data)
            throw error
        }
    }
}

public struct DappArg: Equatable, Hashable, Codable {
    var url: String
    var isUrlEnsured: Bool?
    var accountId: String
    
    public init(url: String, isUrlEnsured: Bool? = nil, accountId: String) {
        self.url = url
        self.isUrlEnsured = isUrlEnsured
        self.accountId = accountId
    }
}
