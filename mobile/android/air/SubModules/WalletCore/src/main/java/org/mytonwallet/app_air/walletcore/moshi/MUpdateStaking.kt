package org.mytonwallet.app_air.walletcore.moshi

import com.squareup.moshi.JsonClass
import org.mytonwallet.app_air.walletcore.MYCOIN_SLUG
import org.mytonwallet.app_air.walletcore.STAKED_MYCOIN_SLUG
import org.mytonwallet.app_air.walletcore.STAKED_USDE_SLUG
import org.mytonwallet.app_air.walletcore.STAKE_SLUG
import org.mytonwallet.app_air.walletcore.TONCOIN_SLUG
import org.mytonwallet.app_air.walletcore.USDE_SLUG
import java.math.BigInteger

@JsonClass(generateAdapter = true)
data class MUpdateStaking(
    val accountId: String,
    val states: List<StakingState?>,
    val totalProfit: BigInteger,
    val shouldUseNominators: Boolean?,
) {

    private val tonStakingState: StakingState? by lazy {
        states.firstOrNull {
            if (shouldUseNominators == true)
                it is StakingState.Nominators
            else it is StakingState.Liquid
        }
    }

    private val mycoinStakingState: StakingState? by lazy {
        states.firstOrNull {
            it is StakingState.Jetton && it.tokenSlug == MYCOIN_SLUG
        }
    }

    private val usdeStakingState: StakingState? by lazy {
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

    fun stakingState(tokenSlug: String): StakingState? {
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
}
