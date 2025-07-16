package org.mytonwallet.app_air.walletcore.api

import org.mytonwallet.app_air.walletcore.WalletCore
import org.mytonwallet.app_air.walletcore.models.MBlockchain
import org.mytonwallet.app_air.walletcore.moshi.MApiCheckTransactionDraftOptions
import org.mytonwallet.app_air.walletcore.moshi.MApiCheckTransactionDraftResult
import org.mytonwallet.app_air.walletcore.moshi.MApiSubmitTransferOptions
import org.mytonwallet.app_air.walletcore.moshi.MApiSubmitTransferResult

suspend fun WalletCore.Transfer.checkTransactionDraft(
    chain: MBlockchain,
    options: MApiCheckTransactionDraftOptions
) = run {
    val moshi = WalletCore.moshi
    val arg = moshi.adapter(MApiCheckTransactionDraftOptions::class.java).toJson(options)

    WalletCore.bridge!!.callApiAsync<MApiCheckTransactionDraftResult>(
        "checkTransactionDraft",
        "[\"${chain.name}\", $arg]",
        MApiCheckTransactionDraftResult::class.java
    )
}

suspend fun WalletCore.Transfer.submitTransfer(
    chain: MBlockchain,
    options: MApiSubmitTransferOptions
): Any = run {
    val moshi = WalletCore.moshi
    val arg = moshi.adapter(MApiSubmitTransferOptions::class.java).toJson(options)
    val args = "[\"${chain.name}\", $arg]"

    when (chain) {
        MBlockchain.ton -> WalletCore.bridge!!.callApiAsync<MApiSubmitTransferResult.Ton>(
            "submitTransfer", args,
            MApiSubmitTransferResult.Ton::class.java
        )

        MBlockchain.tron -> WalletCore.bridge!!.callApiAsync<MApiSubmitTransferResult.Tron>(
            "submitTransfer", args,
            MApiSubmitTransferResult.Tron::class.java
        )

        else -> throw NotImplementedError()
    }
}
