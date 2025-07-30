package org.mytonwallet.app_air.walletcore.moshi

import com.squareup.moshi.JsonClass
import org.mytonwallet.app_air.walletcore.MYCOIN_SLUG
import org.mytonwallet.app_air.walletcore.STAKED_MYCOIN_SLUG
import org.mytonwallet.app_air.walletcore.STAKED_USDE_SLUG
import org.mytonwallet.app_air.walletcore.STAKE_SLUG
import org.mytonwallet.app_air.walletcore.TONCOIN_SLUG
import org.mytonwallet.app_air.walletcore.USDE_SLUG
import org.mytonwallet.app_air.walletcore.models.MTokenBalance
import org.mytonwallet.app_air.walletcore.stores.TokenStore
import java.math.BigInteger

@JsonClass(generateAdapter = true)
data class MUpdateStaking(
    val accountId: String,
    val states: List<StakingState?>,
    val totalProfit: BigInteger,
    val shouldUseNominators: Boolean?,
) {

    val tonStakingState: StakingState? by lazy {
        states.firstOrNull {
            if (shouldUseNominators == true)
                it is StakingState.Nominators
            else it is StakingState.Liquid
        }
    }

    val mycoinStakingState: StakingState? by lazy {
        states.firstOrNull {
            it is StakingState.Jetton && it.tokenSlug == MYCOIN_SLUG
        }
    }

    val usdeStakingState: StakingState? by lazy {
        states.firstOrNull {
            it is StakingState.Ethena && it.tokenSlug == USDE_SLUG
        }
    }

    val tonBalance: BigInteger?
        get() {
            return tonStakingState?.balance
        }

    val mycoinBalance: BigInteger?
        get() {
            return mycoinStakingState?.balance
        }

    val usdeBalance: BigInteger?
        get() {
            return usdeStakingState?.balance
        }

    fun stakingState(tokenSlug: String?): StakingState? {
        return when (tokenSlug) {
            TONCOIN_SLUG, STAKE_SLUG -> {
                tonStakingState
            }

            MYCOIN_SLUG, STAKED_MYCOIN_SLUG -> {
                mycoinStakingState
            }

            USDE_SLUG, STAKED_USDE_SLUG -> {
                usdeStakingState
            }

            else -> {
                null
            }
        }
    }

    private fun balanceInBaseCurrency(
        slug: String,
        balance: BigInteger?,
        selector: MTokenBalance.() -> Double?
    ): Double {
        return MTokenBalance.fromParameters(TokenStore.getToken(slug), balance)
            ?.let(selector) ?: 0.0
    }

    fun totalBalanceInBaseCurrency(): Double {
        return balanceInBaseCurrency(TONCOIN_SLUG, tonBalance) { toBaseCurrency } +
            balanceInBaseCurrency(MYCOIN_SLUG, mycoinBalance) { toBaseCurrency } +
            balanceInBaseCurrency(USDE_SLUG, usdeBalance) { toBaseCurrency }
    }

    fun totalBalanceInBaseCurrency24h(): Double {
        return balanceInBaseCurrency(TONCOIN_SLUG, tonBalance) { toBaseCurrency24h } +
            balanceInBaseCurrency(MYCOIN_SLUG, mycoinBalance) { toBaseCurrency24h } +
            balanceInBaseCurrency(USDE_SLUG, usdeBalance) { toBaseCurrency24h }
    }
}
