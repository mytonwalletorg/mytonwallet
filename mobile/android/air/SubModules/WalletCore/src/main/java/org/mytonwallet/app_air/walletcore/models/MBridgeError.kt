package org.mytonwallet.app_air.walletcore.models

import org.mytonwallet.app_air.walletcontext.R
import org.mytonwallet.app_air.walletcontext.helpers.LocaleController

class MBridgeException(val error: MBridgeError) : Throwable()

enum class MBridgeError(val errorName: String? = null, var customMessage: String? = null) {
    SERVER_ERROR("ServerError"),
    INVALID_MNEMONIC("Invalid mnemonic"),

    // transaction errors
    PARTIAL_TRANSACTION_FAILURE("PartialTransactionFailure"),
    INCORRECT_DEVICE_TIME("IncorrectDeviceTime"),
    INSUFFICIENT_BALANCE("InsufficientBalance"),
    UNSUCCESSFUL_TRANSFER("UnsuccessfulTransfer"),
    UNSUPPORTED_HARDWARE_CONTRACT("UnsupportedHardwareContract"),
    UNSUPPORTED_HARDWARE_PAYLOAD("UnsupportedHardwarePayload"),
    NON_ASCII_COMMENT_FOR_HARDWARE_OPERATION("NonAsciiCommentForHardwareOperation"),
    TOO_LONG_COMMENT_FOR_HARDWARE_OPERATION("TooLongCommentForHardwareOperation"),
    UNSUPPORTED_HARDWARE_NFT_OPERATION("UnsupportedHardwareNftOperation"),
    PAIR_NOT_FOUND("PairNotFound"),
    TOO_SMALL_AMOUNT("TooSmallAmount"),
    CANCELED_BY_THE_USER("Canceled by the user"),
    REJECTED_BY_USER("RejectedByUser"),

    PARSE_ERROR("JSON Parse Error"),
    UNKNOWN("Unknown");

    val toLocalized: String
        get() {
            return customMessage ?: when (this) {
                SERVER_ERROR -> LocaleController.getString(R.string.Error_ServerError)
                INVALID_MNEMONIC -> LocaleController.getString(R.string.WordImport_IncorrectText)
                PARTIAL_TRANSACTION_FAILURE -> LocaleController.getString(R.string.Error_PartialTransactionFailure)
                INCORRECT_DEVICE_TIME -> LocaleController.getString(R.string.Error_IncorrectDeviceTime)
                INSUFFICIENT_BALANCE -> LocaleController.getString(R.string.Error_InsufficientBalance)
                UNSUCCESSFUL_TRANSFER -> LocaleController.getString(R.string.Error_UnsuccesfulTransfer)
                UNSUPPORTED_HARDWARE_CONTRACT -> LocaleController.getString(R.string.Error_UnsupportedHardwareContract)
                UNSUPPORTED_HARDWARE_PAYLOAD -> LocaleController.getString(R.string.Error_UnsupportedHardwarePayload)
                NON_ASCII_COMMENT_FOR_HARDWARE_OPERATION -> LocaleController.getString(R.string.Error_NonAsciiCommentForHardwareOperation)
                TOO_LONG_COMMENT_FOR_HARDWARE_OPERATION -> LocaleController.getString(R.string.Error_TooLongCommentForHardwareOperation)
                UNSUPPORTED_HARDWARE_NFT_OPERATION -> LocaleController.getString(R.string.Error_UnsupportedHardwareNftOperation)
                PAIR_NOT_FOUND -> LocaleController.getString(R.string.Error_PairNotFound)
                TOO_SMALL_AMOUNT -> LocaleController.getString(R.string.Error_TooSmallAmount)
                CANCELED_BY_THE_USER, REJECTED_BY_USER -> LocaleController.getString(R.string.Error_CanceledByTheUser)
                PARSE_ERROR, UNKNOWN -> LocaleController.getString(R.string.Error_ServerError)
            }
        }

    val toShortLocalized: String?
        get() {
            return customMessage ?: when (this) {
                SERVER_ERROR -> LocaleController.getString(R.string.Error_NetworkError_Short)
                PAIR_NOT_FOUND -> LocaleController.getString(R.string.Error_PairNotFound)
                TOO_SMALL_AMOUNT -> LocaleController.getString(R.string.Error_TooSmallAmount)
                CANCELED_BY_THE_USER, REJECTED_BY_USER -> LocaleController.getString(R.string.Error_CanceledByTheUser)
                PARSE_ERROR, UNKNOWN -> LocaleController.getString(R.string.Error_ServerError)
                else -> null
            }
        }
}
