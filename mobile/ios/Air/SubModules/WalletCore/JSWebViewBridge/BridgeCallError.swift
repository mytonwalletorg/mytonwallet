
import Foundation
import WalletContext


public enum BridgeCallError: Error {
    case message(BridgeCallErrorMessages, Any?)
    case customMessage(String, Any?)
    case unknown(baseError: Any? = nil)
    case apiReturnedError(error: String, data: Any)
    
    init(message: String, payload: Any?) {
        if let known = BridgeCallErrorMessages(rawValue: message) {
            self = .message(known, payload)
        } else {
            self = .customMessage(message, payload)
        }
    }
    
    static func tryToParseDataAsErrorAndThrow(data: Any?) throws {
        if let data, let errorValue = try? JSONSerialization.decode(ApiReturnError.self, from: data) {
            throw BridgeCallError.apiReturnedError(error: errorValue.error, data: data)
        }
    }
}

public enum BridgeCallErrorMessages: String {
    case serverError = "ServerError"
    case invalidMnemonic = "Invalid mnemonic"
    
    // transaction errors
    case partialTransactionFailure = "PartialTransactionFailure"
    case incorrectDeviceTime = "IncorrectDeviceTime"
    case insufficientBalance = "InsufficientBalance"
    case unsuccesfulTransfer = "UnsuccesfulTransfer"
    case unsupportedHardwareContract = "UnsupportedHardwareContract"
    case unsupportedHardwarePayload = "UnsupportedHardwarePayload"
    case nonAsciiCommentForHardwareOperation = "NonAsciiCommentForHardwareOperation"
    case tooLongCommentForHardwareOperation = "TooLongCommentForHardwareOperation"
    case unsupportedHardwareNftOperation = "UnsupportedHardwareNftOperation"
    case invalidAddress = "InvalidAddress"
    
    case unknown
    
    public var toLocalized: String {
        switch self {
        case .serverError:
            return WStrings.Error_ServerError.localized
        case .invalidMnemonic:
            return WStrings.WordImport_IncorrectText.localized
        case .partialTransactionFailure:
            return WStrings.Error_PartialTransactionFailure.localized
        case .incorrectDeviceTime:
            return WStrings.Error_IncorrectDeviceTime.localized
        case .insufficientBalance:
            return WStrings.Error_InsufficientBalance.localized
        case .unsuccesfulTransfer:
            return WStrings.Error_UnsuccesfulTransfer.localized
        case .unsupportedHardwareContract:
            return WStrings.Error_UnsupportedHardwareContract.localized
        case .unsupportedHardwarePayload:
            return WStrings.Error_UnsupportedHardwarePayload.localized
        case .nonAsciiCommentForHardwareOperation:
            return WStrings.Error_NonAsciiCommentForHardwareOperation.localized
        case .tooLongCommentForHardwareOperation:
            return WStrings.Error_TooLongCommentForHardwareOperation.localized
        case .unsupportedHardwareNftOperation:
            return WStrings.Error_UnsupportedHardwareNftOperation.localized
        case .invalidAddress:
            return WStrings.Error_InvalidAddress.localized
        case .unknown:
            return WStrings.Error_ServerError.localized
        }
    }
}

public struct ApiReturnError: Decodable {
    public var error: String
}

extension BridgeCallError: LocalizedError {
    public var errorDescription: String? {
        switch self {
        case .message(let message, _):
            return message.toLocalized
        case .customMessage(let string, _):
            return string
        case .unknown(let baseError):
            if let e = baseError as? LocalizedError {
                return e.errorDescription
            }
            return WStrings.Error_ServerError.localized
        case .apiReturnedError(let error, _):
            return error
        }
    }
}
