package org.mytonwallet.app_air.walletcore.moshi

import com.squareup.moshi.Json
import com.squareup.moshi.JsonClass
import java.math.BigInteger

sealed class StakingState {
    abstract val stakingType: String
    abstract val id: String
    abstract val tokenSlug: String
    abstract val annualYield: Float
    abstract val yieldType: YieldType
    abstract val balance: BigInteger
    abstract val pool: String
    abstract val isUnstakeRequested: Boolean?

    @JsonClass(generateAdapter = true)
    data class Liquid(
        @Transient override val stakingType: String = "liquid",
        override val id: String,
        override val tokenSlug: String,
        override val annualYield: Float,
        override val yieldType: YieldType,
        override val balance: BigInteger,
        override val pool: String,
        override val isUnstakeRequested: Boolean?,
        val tokenBalance: String,
        val unstakeRequestAmount: String,
        val instantAvailable: BigInteger
    ) : StakingState()

    @JsonClass(generateAdapter = true)
    data class Jetton(
        @Transient override val stakingType: String = "jetton",
        override val id: String,
        override val tokenSlug: String,
        override val annualYield: Float,
        override val yieldType: YieldType,
        override val balance: BigInteger,
        override val pool: String,
        override val isUnstakeRequested: Boolean?,
        val tokenAddress: String,
        val unclaimedRewards: BigInteger,
        val stakeWalletAddress: String,
        val tokenAmount: String,
        val period: Double,
        val tvl: String,
        val dailyReward: String,
        val poolWallets: List<String>?
    ) : StakingState()

    @JsonClass(generateAdapter = true)
    data class Ethena(
        @Transient override val stakingType: String = "ethena",
        override val id: String,
        override val tokenSlug: String,
        override val annualYield: Float,
        override val yieldType: YieldType,
        override val balance: BigInteger,
        override val pool: String,
        override val isUnstakeRequested: Boolean?,
        val tokenBalance: BigInteger?,
        val tsUsdeWalletAddress: String?,
        val lockedBalance: BigInteger?,
        val unlockTime: Long?,
        val annualYieldStandard: Float,
        val annualYieldVerified: Float,
    ) : StakingState()

    @JsonClass(generateAdapter = true)
    data class Nominators(
        @Transient override val stakingType: String = "nominators",
        override val id: String,
        override val tokenSlug: String,
        override val annualYield: Float,
        override val yieldType: YieldType,
        override val balance: BigInteger,
        override val pool: String,
        override val isUnstakeRequested: Boolean?,
        val pendingDepositAmount: String
    ) : StakingState()

    @JsonClass(generateAdapter = false)
    enum class YieldType {
        @Json(name = "APY")
        APY,

        @Json(name = "APR")
        APR
    }
}
