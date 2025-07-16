package org.mytonwallet.app_air.walletcore.models

import org.json.JSONObject
import org.mytonwallet.app_air.walletcontext.utils.doubleAbsRepresentation
import org.mytonwallet.app_air.walletcore.STAKED_MYCOIN_SLUG
import org.mytonwallet.app_air.walletcore.STAKED_USDE_SLUG
import org.mytonwallet.app_air.walletcore.STAKE_SLUG
import org.mytonwallet.app_air.walletcore.TONCOIN_SLUG
import org.mytonwallet.app_air.walletcore.TON_USDT_SLUG
import org.mytonwallet.app_air.walletcore.TRON_SLUG
import org.mytonwallet.app_air.walletcore.TRON_USDT_SLUG
import java.math.BigInteger

class MTokenBalance private constructor(
    val token: String?,
    val amountValue: BigInteger,
    var toBaseCurrency: Double?,
    var toBaseCurrency24h: Double?,
    val toUsdBaseCurrency: Double?,
) {

    val priority: Int
        get() {
            return when (token) {
                STAKE_SLUG -> 3
                STAKED_MYCOIN_SLUG -> 2
                STAKED_USDE_SLUG -> 1
                else -> 0
            }
        }

    val priorityOnSameBalance: Int
        get() {
            return when (token) {
                TONCOIN_SLUG -> 4
                TON_USDT_SLUG -> 3
                TRON_SLUG -> 2
                TRON_USDT_SLUG -> 1
                else -> 0
            }
        }

    companion object {
        // Factory method to create an instance from JSON
        fun fromJson(json: JSONObject): MTokenBalance {
            val token = json.optJSONObject("token")?.optString("slug")
            val amountValueString = json.optString("balance").substringAfter("bigint:", "")
            val amountValue = amountValueString.toBigIntegerOrNull() ?: BigInteger.ZERO
            return MTokenBalance(token, amountValue, null, null, null)
        }

        // Factory method to create an instance from separate parameters
        fun fromParameters(token: MToken, amount: BigInteger): MTokenBalance {
            val toBaseCurrency =
                token.price?.let { amount.doubleAbsRepresentation(token.decimals) * it }
            val priceYesterday =
                token.price?.let { (token.price!!) / (1 + token.percentChange24hReal / 100) }
            val toBaseCurrency24h =
                priceYesterday?.let { amount.doubleAbsRepresentation(token.decimals) * priceYesterday }
            val toUsdBaseCurrency =
                token.priceUsd.let { amount.doubleAbsRepresentation(token.decimals) * it }
            return MTokenBalance(
                token.slug,
                amount,
                toBaseCurrency,
                toBaseCurrency24h,
                toUsdBaseCurrency
            )
        }
    }
}
