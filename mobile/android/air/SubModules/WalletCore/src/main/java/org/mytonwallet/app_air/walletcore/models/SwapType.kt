package org.mytonwallet.app_air.walletcore.models

import org.mytonwallet.app_air.walletcore.moshi.MApiSwapAsset

enum class SwapType {
    ON_CHAIN,
    CROSS_CHAIN_FROM_TON,
    CROSS_CHAIN_TO_TON;

    companion object {
        fun from(tokenToSend: MApiSwapAsset, tokenToReceive: MApiSwapAsset): SwapType {
            return when {
                tokenToReceive.chain != "ton" -> CROSS_CHAIN_FROM_TON
                tokenToSend.chain != "ton" -> CROSS_CHAIN_TO_TON
                else -> ON_CHAIN
            }
        }
    }
}
